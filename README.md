NBA Betting Research Tool
A local web application for researching NBA player stats to make more informed sports betting decisions. Built with Node.js and powered by the official NBA Stats API (stats.nba.com).

Features

Full NBA Roster — Every active player across all 30 teams, pulled live from the official NBA Stats API
Last 14 Games — Real game log including regular season and playoff games
Prop Line Checker — Enter a betting line and instantly see what percentage of the last 14 games the player went over
Color-Coded Game Log — Green for over, red for under, gold for push
Combo Props — Supports Points + Rebounds + Assists and Steals + Blocks combos
Season Selector — Switch between 2025-26 (current), 2024-25, and 2023-24
Trend Indicators — Compares 14-game average vs last 5-game average to spot hot and cold streaks
Playoff Tagged — Playoff games are marked with a gold PO badge


Tech Stack

Backend — Node.js and Express
Frontend — Vanilla HTML, CSS, JavaScript
Data Source — stats.nba.com (Official NBA Stats API)


Getting Started
Prerequisites

Node.js v18 or higher
Git

Installation

Clone the repository

git clone https://github.com/alex2003galarza-dev/nba-betting-research.git
cd nba-betting-research

Install dependencies

npm install

Start the server

node server.js

Open your browser and go to

http://localhost:3000

How to Use

Search for a player using the search bar or filter by team
Click a player to load their last 14 games
Enter a prop line such as 24.5 for Points in the Prop Line Checker
The app shows you the hit rate — how often they went over that line
Click color table to highlight the game log green for over or red for under
Use the season selector to look at previous seasons for deeper research


Project Structure
nba-betting-research/
├── server.js
├── package.json
├── public/
│   └── index.html
└── README.md

How It Works
The Express server acts as a middleware layer between the browser and stats.nba.com. This is necessary because the NBA Stats API requires specific request headers that can only be set server-side.
On startup the server fetches rosters for all 30 NBA teams and caches them for 1 hour. When you select a player it fetches their regular season and playoff game logs in parallel, merges them, sorts by date, and returns the last 14 games.

Notes

This tool is for personal research use only
The NBA Stats API is unofficial and undocumented — endpoints may change
Please gamble responsibly


Built By
Alex Galarza — Personal Project
