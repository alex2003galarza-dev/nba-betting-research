const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));

const NBA_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://www.nba.com/',
  'Origin': 'https://www.nba.com',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token': 'true',
  'Connection': 'keep-alive',
};

async function nbaFetch(url) {
  console.log(`[NBA] ${url}`);
  const res = await fetch(url, { headers: NBA_HEADERS });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`NBA API ${res.status}: ${text.slice(0, 120)}`);
  }
  return res.json();
}

function parseResultSet(data, index = 0) {
  const rs = data.resultSets?.[index];
  if (!rs) throw new Error('No result set');
  return rs.rowSet.map(row => {
    const obj = {};
    rs.headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

// All NBA team IDs (30 teams)
const NBA_TEAMS = [
  { id: 1610612737, abbr: 'ATL' }, { id: 1610612738, abbr: 'BOS' },
  { id: 1610612751, abbr: 'BKN' }, { id: 1610612766, abbr: 'CHA' },
  { id: 1610612741, abbr: 'CHI' }, { id: 1610612739, abbr: 'CLE' },
  { id: 1610612742, abbr: 'DAL' }, { id: 1610612743, abbr: 'DEN' },
  { id: 1610612765, abbr: 'DET' }, { id: 1610612744, abbr: 'GSW' },
  { id: 1610612745, abbr: 'HOU' }, { id: 1610612754, abbr: 'IND' },
  { id: 1610612746, abbr: 'LAC' }, { id: 1610612747, abbr: 'LAL' },
  { id: 1610612763, abbr: 'MEM' }, { id: 1610612748, abbr: 'MIA' },
  { id: 1610612749, abbr: 'MIL' }, { id: 1610612750, abbr: 'MIN' },
  { id: 1610612740, abbr: 'NOP' }, { id: 1610612752, abbr: 'NYK' },
  { id: 1610612760, abbr: 'OKC' }, { id: 1610612753, abbr: 'ORL' },
  { id: 1610612755, abbr: 'PHI' }, { id: 1610612756, abbr: 'PHX' },
  { id: 1610612757, abbr: 'POR' }, { id: 1610612758, abbr: 'SAC' },
  { id: 1610612759, abbr: 'SAS' }, { id: 1610612761, abbr: 'TOR' },
  { id: 1610612762, abbr: 'UTA' }, { id: 1610612764, abbr: 'WAS' },
];

// Cache roster so we don't re-fetch on every request
let rosterCache = null;
let rosterCacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function getAllPlayers() {
  if (rosterCache && Date.now() - rosterCacheTime < CACHE_TTL) {
    return rosterCache;
  }

  console.log('[NBA] Fetching all team rosters...');
  const allPlayers = [];

  // Fetch all rosters in parallel, 6 at a time to avoid rate limiting
  for (let i = 0; i < NBA_TEAMS.length; i += 6) {
    const batch = NBA_TEAMS.slice(i, i + 6);
    await Promise.all(batch.map(async team => {
      try {
        const url = `https://stats.nba.com/stats/commonteamroster?TeamID=${team.id}&Season=2025-26`;
        const data = await nbaFetch(url);
        const rows = parseResultSet(data);
        rows.forEach(p => {
          allPlayers.push({
            id: p.PLAYER_ID,
            name: p.PLAYER,
            team: team.abbr,
            pos: p.POSITION || '',
            num: p.NUM || '',
          });
        });
      } catch(e) {
        console.log(`  Failed roster for ${team.abbr}: ${e.message}`);
      }
    }));
    // Small delay between batches to be nice to the API
    if (i + 6 < NBA_TEAMS.length) await new Promise(r => setTimeout(r, 200));
  }

  allPlayers.sort((a, b) => a.name.localeCompare(b.name));
  console.log(`[NBA] Loaded ${allPlayers.length} players across all teams`);

  rosterCache = allPlayers;
  rosterCacheTime = Date.now();
  return allPlayers;
}

// GET /api/nba/players — returns full roster of all 30 teams
app.get('/api/nba/players', async (req, res) => {
  try {
    const players = await getAllPlayers();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(players);
  } catch(e) {
    console.error(e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/nba/gamelog/:playerId — regular season + playoffs merged
app.get('/api/nba/gamelog/:playerId', async (req, res) => {
  const { playerId } = req.params;
  const season = req.query.season || '2025-26';
  const base = `https://stats.nba.com/stats/playergamelog?PlayerID=${playerId}&Season=${season}`;

  async function fetchSeasonType(type) {
    try {
      const url = `${base}&SeasonType=${encodeURIComponent(type)}`;
      const data = await nbaFetch(url);
      const rs = data.resultSets?.[0];
      if (!rs?.rowSet?.length) return [];
      return rs.rowSet.map(row => {
        const obj = {};
        rs.headers.forEach((h, i) => obj[h] = row[i]);
        return obj;
      });
    } catch(e) {
      console.log(`  ${type} fetch failed: ${e.message}`);
      return [];
    }
  }

  try {
    const [regular, playoffs] = await Promise.all([
      fetchSeasonType('Regular Season'),
      fetchSeasonType('Playoffs'),
    ]);

    const all = [...regular, ...playoffs];
    if (!all.length) {
      return res.status(404).json({ error: 'No games found' });
    }

    // Sort newest first, take last 14, reverse for display
    all.sort((a, b) => new Date(b.GAME_DATE) - new Date(a.GAME_DATE));
    const last14 = all.slice(0, 14).reverse();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({
      games: last14,
      totalRegular: regular.length,
      totalPlayoffs: playoffs.length,
    });
  } catch(e) {
    console.error(e.message);
    res.status(500).json({ error: e.message });
  }
});

// Debug endpoint
app.get('/api/nba/debug/:playerId', async (req, res) => {
  const { playerId } = req.params;
  const season = req.query.season || '2024-25';
  const type = req.query.type || 'Playoffs';
  try {
    const url = `https://stats.nba.com/stats/playergamelog?PlayerID=${playerId}&Season=${season}&SeasonType=${encodeURIComponent(type)}`;
    const data = await nbaFetch(url);
    const rs = data.resultSets?.[0];
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({
      headers: rs?.headers,
      totalGames: rs?.rowSet?.length,
      recentGames: rs?.rowSet?.slice(0, 5).map(row => {
        const obj = {};
        rs.headers.forEach((h, i) => obj[h] = row[i]);
        return obj;
      }),
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n✅ NBA Betting Research Tool — http://localhost:${PORT}`);
  console.log(`   Fetching rosters from stats.nba.com on first load...\n`);
});