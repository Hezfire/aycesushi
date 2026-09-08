# AYCE Sushi Worth-It Calculator

Track what you eat at all-you-can-eat sushi and see whether you **beat the buffet** — built for one-handed use at the table.

## How it works (game loop)

1. **Find your restaurant** (search or add)
2. **Start a meal** and confirm AYCE price
3. **Tap items** as you eat — watch live menu value climb
4. **Break even** → finish meal → see your score
5. **Add yourself to the restaurant leaderboard** and share

Menu import (URL / PDF / photo / paste) is a **secondary** path when a restaurant has no stored menu yet. Day-to-day diners do not need it.

Scores use **estimated menu value** when exact restaurant pricing isn’t available. Leaderboard `beat_buffet_by` is always computed on the server.

After a completed meal, you can post to a **restaurant-specific** Neon Postgres leaderboard.

---

## Before you start (one-time setup)

### Step 1 — Install Node.js (manual step)

You need **Node.js** (includes `npm`) on your computer.

1. Open: https://nodejs.org  
2. Download the **LTS** version and install it.  
3. Restart Cursor (or your terminal) after installing.

To check it worked, open a terminal and run:

```bash
node -v
npm -v
```

You should see version numbers (not an error).

---

## Run the app locally (UI only)

```bash
cd /Users/lisahadi/Projects/ayce-sushi-calculator
npm install
npm run dev
```

Open the local URL (e.g. `http://localhost:5173`).

> Menu import and leaderboard/restaurant APIs need `vercel dev` + env vars (next section).

### Run unit tests

```bash
npm test
```

---

## Full stack locally (API + Neon + Gemini)

### Env

```bash
cp .env.example .env.local
```

Set:

- `GEMINI_API_KEY` — Google AI Studio (menu import)
- `DATABASE_URL` — Neon Postgres connection string (restaurants, menus, leaderboard)

Tables (including `menu_items`) are created automatically on the first API request. See `api/schema.sql`.

### Run

```bash
npm run dev:full
```

---

## Deploy (Vercel)

1. Import the GitHub repo on Vercel  
2. Set `GEMINI_API_KEY` and `DATABASE_URL`  
3. Deploy (and redeploy after changing env)

Public app: `https://aycesushi.vercel.app`

---

## Routes

| Path | Purpose |
|------|---------|
| `/` | Landing — Find your restaurant |
| `/find` | Search / add restaurant |
| `/restaurants/:id` | Restaurant detail + top 3 |
| `/restaurants/:id/meal` | Live meal tracker |
| `/restaurants/:id/meal/result` | Finish / share / submit |
| `/restaurants/:id/leaderboard` | Full top-25 board |

---

## Project map

| File / folder | What it does |
|---|---|
| `src/pages/HomePage.jsx` | Restaurant-first landing |
| `src/pages/MealPage.jsx` | Live score + item logging |
| `src/pages/ResultPage.jsx` | End-of-meal result + share |
| `src/hooks/useMealSession.js` | localStorage meal state (v4) |
| `api/restaurants/` | Search, create, detail, menu |
| `api/leaderboard/` | Submit, list, recent records |
| `api/import-menu.js` | Secondary Gemini menu import |
| `api/schema.sql` | Neon schema reference |

---

## Leaderboard notes

- Ranking: `beat_buffet_by` DESC, then value DESC, then earlier `completed_at`
- Duplicate `client_meal_id` rejected
- No login; anonymous `visitorId` highlights your row
- `google_place_id` reserved for a future Places search
