# AYCE Sushi Worth-It Calculator

Track what you eat at all-you-can-eat sushi and see whether you’re beating the price you paid — built for one-handed use at the table.

You can also **import a restaurant menu from a website URL**. The server reads the page, uses Google Gemini (free tier) to list items, and estimates typical à la carte prices. Review those prices before you start logging pieces.

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

> **Note:** Menu URL import needs the API (next section). Counters and the default menu work with `npm run dev` alone.

### Stop the app

In the terminal, press `Ctrl + C`.

---

## Test menu import locally (needs API + free Gemini key)

Menu import calls `/api/import-menu`, which only runs through **Vercel** (or `vercel dev`).

### Manual step A — Free Gemini API key

1. Open https://aistudio.google.com/apikey  
2. Sign in with a Google account.  
3. Create an API key (free tier).  
4. Copy the key somewhere safe — do **not** put it in frontend code or commit it to git.

### Manual step B — Vercel CLI (already in this project)

No global install needed. The project includes Vercel locally.

### Manual step C — Local env file

```bash
cd /Users/lisahadi/Projects/ayce-sushi-calculator
cp .env.example .env.local
```

Open `.env.local` and replace `paste_your_free_google_ai_studio_key_here` with your real key. Save.
(If we already created `.env.local` for you, you can skip this copy step.)

### Manual step D — Run front-end + API together

```bash
npm run dev:full
```

The first time, Vercel may ask you to log in / link a project — follow the prompts in the terminal.
Open the URL it prints. Paste a menu URL in **Import from menu URL**, review the list, then tap **Use this menu**.

If a restaurant site blocks fetching (common for heavy JavaScript menus), use **Paste menu text instead**.

---

## Publish so everyone can use it (manual steps)

These steps put the app on the public internet (free Vercel hosting). The Gemini key stays on the server so visitors cannot steal it.

### 1) Push the project to GitHub (recommended)

**Manual step:** Create a GitHub account if needed, create a new repository, and push this folder.  
(If you prefer, Vercel can also upload from your computer without GitHub.)

### 2) Deploy on Vercel

1. Open https://vercel.com and sign up (free).  
2. Click **Add New… → Project**.  
3. Import this repository (or upload the project).  
4. Framework should detect **Vite**. Leave build settings as defaults (`npm run build`, output `dist`).  
5. Before deploying, open **Environment Variables** and add:
   - Name: `GEMINI_API_KEY`  
   - Value: your free Google AI Studio key  
   - Environments: Production, Preview, Development  
6. Click **Deploy**.

When it finishes, Vercel gives a public URL like:

`https://ayce-sushi-calculator.vercel.app`

Anyone with that link can use the calculator. Optional later: add a custom domain in Vercel → Project → Settings → Domains.

### Quota note (plain language)

The free Gemini allowance is shared by **all visitors** of your published site. If many people import menus, you may see “quota used up” errors until it resets. The API also rate-limits rapid repeat imports.

---

## How to use at the restaurant

1. (Optional) Import a menu from the restaurant’s website URL, review prices, tap **Use this menu**.  
2. Enter what you paid for AYCE (add drinks/fees if you want them counted).  
3. Tap **+** each time you finish a piece.  
4. Watch the sticky banner for value eaten vs paid and the break-even meter.  
5. Tap an item **name** to edit its price or remove it.  
6. Use **Add custom item** for anything missing.  
7. Tap **New meal / reset** next visit.

Progress auto-saves in that phone/browser until you reset.

---

## Change the default menu by hand

Open `src/data/defaultMenu.js`, edit names and `pricePerPiece` values, save, refresh, then tap **New meal / reset**.

---

## Project map

| File / folder | What it does |
|---|---|
| `src/data/defaultMenu.js` | Default sushi items & prices (fallback menu) |
| `src/components/ImportMenuPanel.jsx` | URL / paste import + review UI |
| `api/import-menu.js` | Server: fetch page + Gemini extract/estimate |
| `src/hooks/useMealSession.js` | Meal state + browser save |
| `src/utils/worthIt.js` | Break-even / “worth it” messages |
| `vercel.json` | Vercel hosting config |
| `.env.example` | Template for `GEMINI_API_KEY` |
| `src/App.jsx` | Main page layout |
# aycesushi
