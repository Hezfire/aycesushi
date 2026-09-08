# AYCE Sushi Worth-It Calculator

Track what you eat at all-you-can-eat sushi and see whether you’re beating the price you paid — built for one-handed use at the table.

You can also **import a restaurant menu from a website URL**. The server reads the page, uses Google Gemini (free tier) to list items, and estimates **grocery/store-bought** sushi value (not restaurant à la carte). Review those prices before you start logging pieces.

After a completed meal (price paid + pieces eaten), you can **add yourself to a restaurant-specific “Beat the Buffet” leaderboard**. Scores are stored in Neon Postgres; `beat_buffet_by` is always computed on the server as value eaten − AYCE price paid.

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

### Step 2 — Open a terminal in this project folder

**Manual step:** In Cursor, open the folder:

`/Users/lisahadi/Projects/ayce-sushi-calculator`

Then open the terminal (Terminal → New Terminal).

### Step 3 — Install dependencies (first time only)

**Manual step — copy and paste this command**, then press Enter:

```bash
cd /Users/lisahadi/Projects/ayce-sushi-calculator
npm install
```

Wait until it finishes.

### Step 4 — Start the front-end only

**Manual step — copy and paste:**

```bash
npm run dev
```

You’ll see a local address like `http://localhost:5173`.  
Open that link in your browser.

> **Note:** Menu URL import and leaderboard submit need the API (next section). Counters and the default menu work with `npm run dev` alone.

### Stop the app

In the terminal, press `Ctrl + C`.

### Run unit tests

```bash
npm test
```

---

## Test menu import + leaderboard locally (needs API + env)

Menu import and leaderboard APIs only run through **Vercel** (or `vercel dev`).

### Manual step A — Free Gemini API key

1. Open https://aistudio.google.com/apikey  
2. Sign in with a Google account.  
3. Create an API key (free tier).  
4. Copy the key somewhere safe — do **not** put it in frontend code or commit it to git.

### Manual step B — Neon database (leaderboards)

1. Open https://console.neon.tech and create a free project.  
2. Copy the connection string (`DATABASE_URL`).  
3. Tables are created automatically on the first leaderboard API request (see `api/schema.sql` for reference).

### Manual step C — Local env file

```bash
cd /Users/lisahadi/Projects/ayce-sushi-calculator
cp .env.example .env.local
```

Open `.env.local` and set:

- `GEMINI_API_KEY` — your Google AI Studio key  
- `DATABASE_URL` — your Neon connection string  

Save. Do not commit `.env.local`.

### Manual step D — Run front-end + API together

```bash
npm run dev:full
```

The first time, Vercel may ask you to log in / link a project — follow the prompts in the terminal.
Open the URL it prints. Paste a menu URL in **Import from menu URL**, review the list, then tap **Use this menu**.

If a restaurant site blocks fetching (common for heavy JavaScript menus), use **Paste menu text instead**.

---

## Publish so everyone can use it (manual steps)

These steps put the app on the public internet (free Vercel hosting). Secrets stay on the server so visitors cannot steal them.

### 1) Push the project to GitHub (recommended)

**Manual step:** Create a GitHub account if needed, create a new repository, and push this folder.  
(If you prefer, Vercel can also upload from your computer without GitHub.)

### 2) Deploy on Vercel

1. Open https://vercel.com and sign up (free).  
2. Click **Add New… → Project**.  
3. Import this repository (or upload the project).  
4. Framework should detect **Vite**. Leave build settings as defaults (`npm run build`, output `dist`).  
5. Before deploying, open **Environment Variables** and add:
   - `GEMINI_API_KEY` — your free Google AI Studio key (Production, Preview, Development)
   - `DATABASE_URL` — Neon Postgres connection string (required for leaderboards)
6. Click **Deploy**.

When it finishes, Vercel gives a public URL like:

`https://aycesushi.vercel.app`

Anyone with that link can use the calculator. Optional later: add a custom domain in Vercel → Project → Settings → Domains.

After changing env vars, **redeploy** so serverless functions pick them up.

### Quota note (plain language)

The free Gemini allowance is shared by **all visitors** of your published site. If many people import menus, you may see “quota used up” errors until it resets. The API also rate-limits rapid repeat imports. Free Neon has its own usage limits.

---

## How to use at the restaurant

1. (Optional) Import a menu from the restaurant’s website URL, review grocery-baseline prices, tap **Use this menu**.  
2. Enter what you paid for AYCE (add drinks/fees if you want them counted).  
3. Tap **+** each time you finish a piece.  
4. Watch the sticky banner for value eaten vs paid and the break-even meter.  
5. Tap an item **name** to edit its price or remove it.  
6. Use **Add custom item** for anything missing.  
7. When the meal is completable (price + pieces), tap **Add me to the leaderboard**, enter your display name and restaurant, then share or view the board.  
8. Tap **New meal / reset** next visit.

Progress auto-saves in that phone/browser until you reset. Leaderboard rows are stored in Neon; your anonymous visitor id is only used to highlight “your” row.

---

## Change the default menu by hand

Open `src/data/defaultMenu.js`, edit names and `pricePerPiece` values, save, refresh, then tap **New meal / reset**.

---

## Project map

| File / folder | What it does |
|---|---|
| `src/data/defaultMenu.js` | Default sushi items & grocery-baseline prices |
| `src/components/ImportMenuPanel.jsx` | URL / paste import + review UI |
| `src/components/LeaderboardSubmit.jsx` | Submit completed meal to a restaurant board |
| `src/pages/LeaderboardPage.jsx` | Full restaurant leaderboard |
| `api/import-menu.js` | Server: fetch page + Gemini extract/estimate |
| `api/leaderboard/` | Submit + list leaderboard APIs |
| `api/restaurants/[id].js` | Restaurant detail + top-3 preview |
| `api/schema.sql` | Neon schema reference |
| `src/hooks/useMealSession.js` | Meal state + browser save |
| `src/utils/worthIt.js` | Break-even / “worth it” messages |
| `vercel.json` | Vercel hosting config |
| `.env.example` | Template for `GEMINI_API_KEY` + `DATABASE_URL` |
| `src/App.jsx` | Main meal tracker |

---

## Leaderboard notes

- Ranking: highest `beat_buffet_by`, then higher value eaten, then earlier completion time.  
- Duplicate submit of the same meal (`client_meal_id`) is rejected.  
- No login; display names can collide. `google_place_id` is reserved for a future Places search.  
- Scores use grocery-baseline value eaten (honest vs inflated restaurant à la carte).
