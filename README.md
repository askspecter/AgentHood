# ESKA

A cinematic character-coin app: every character has a personality, a story,
and a tradeable coin. Dark, film-grade UI — near-black surfaces, gold accent,
serif display type, no emoji anywhere. All code, characters, and copy are
original.

## What works

Everything runs client-side with simulated data (persisted to `localStorage`),
so every feature actually does something:

- **Home** — featured character carousel with live-moving prices, search,
  Trending / Top / Icons / New filters, two-column index grid.
- **Character detail** — live price chart, market stats, lore, watchlist.
- **Trade** — buy/sell a character's coin against a demo USDC balance;
  positions and P/L update in real time.
- **Chat** — talk to a character; it replies in-character (scripted from its
  personality, not a live LLM). Threads are remembered.
- **Create** — mint your own character (name, ticker, aura, soul, vibe) with a
  live preview.
- **You** — balance, add cash, Coins / Creations / Activity / Gallery tabs.
- **Settings** — account rows, appearance toggle, log out.
- **Login** — X only (simulated; no real OAuth, wallet, or funds).
- **Intro** — four-slide onboarding sheet (Trade / Mint / Chat / Shape the lore).

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
npm run preview  # preview the production build
```

## Stack

Vite · React 18 · React Router · Tailwind CSS v4.
Fonts: Instrument Serif, Instrument Sans, Space Mono (open source, bundled).

## Layout

```
src/
  main.jsx / App.jsx      # entry + routes
  index.css               # design system (dark cinematic theme)
  data/charms.js          # seed characters + market data
  lib/store.jsx           # app state: login, balance, trades, chats, mints
  lib/format.js           # number/currency/time helpers
  components/             # Shell, LoginButton, cards, chart, trade panel, icons
  pages/                  # Explore, CharmDetail, Chats, ChatThread, Create, Profile, Settings
```
