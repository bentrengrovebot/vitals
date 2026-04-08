# Vitals

Personal health tracking app — nutrition, training, supplements, weight, symptoms, and blood work in one place. Built for Ben's health optimisation project.

## Features

- **Diary** — meal logging with macro tracking, auto-rebalancing targets, copy meals between days
- **Training** — RP-inspired workout logging with progressive overload, 3-day plan, rest timer, volume tracking
- **Recipes** — build meals from ingredients with per-serving nutrition
- **Supplements** — daily checklist with dose tracking
- **Water** — one-tap logging with daily targets
- **Weight** — trend tracking with 7-day moving average
- **Symptoms** — log gut issues, energy, mood for pattern correlation
- **Insights** — weekly stats dashboard

## Tech Stack

- **Frontend:** React PWA (Vite, mobile-first)
- **Backend:** Node.js / Express
- **Database:** PostgreSQL (Prisma ORM)
- **AI:** Claude via MCP (replaces in-app chat)
- **Deployment:** Railway
- **Auth:** Email + password, JWT

## MCP Integration

Claude connects to the app via a remote MCP endpoint at `/mcp`, providing 32 tools for reading and writing all app data. Works with Claude Code (local stdio) and Claude web (remote HTTP).

**Local (Claude Code):**
```
claude mcp add vitals node mcp-server.js
```

**Remote (claude.ai):**
Add custom connector → `https://vitals.up.railway.app/mcp`

## Getting Started

```bash
# Install
npm install

# Set up database
cp .env.example .env  # fill in DATABASE_URL, JWT_SECRET
npx prisma db push

# Run
npm run dev
```

## Project Structure

```
client/src/
  pages/        — Diary, Training, Recipes, Insights, Settings, FoodPicker, RecipeEdit
  components/   — Shell (layout + nav)
  context/      — AuthContext
  api.js        — Client API methods

server/
  index.js      — Express app entry
  mcp.js        — Remote MCP endpoint (32 tools)
  middleware/    — Auth middleware
  routes/       — API routes (diary, training, profile, recipes, supplements, etc.)

prisma/
  schema.prisma — Database schema
```
