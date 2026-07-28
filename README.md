# ESKA

A market for characters worth owning. Every character has a personality, a
story, and a tradeable coin — discover them, trade the ones you believe in, or
mint your own.

Design: a quiet, premium product aesthetic — light zinc surfaces, a single
restrained indigo accent, editorial serif display, tabular-numeric data, and a
responsive layout (SaaS top-navbar on desktop, tab bar on mobile). All code,
characters, and copy are original.

## What works

Everything runs client-side with simulated data (persisted to `localStorage`):

- **Discover** — editorial hero, featured character, market stats, and a
  full index table (desktop) / card list (mobile) with live-moving prices.
- **Character detail** — live price chart, market stats, story, watchlist.
- **Trade** — buy/sell against a demo USDC balance; positions and P/L update live.
- **Chat** — talk to a character; it replies in-character (scripted, not a live LLM).
- **Create** — mint your own character (name, ticker, aura, soul, vibe) with a live preview.
- **Portfolio** — net worth, add cash, Coins / Creations / Activity tabs.
- **Settings** — account rows, appearance toggle, sign out.
- **Sign in** — X only (simulated; no real OAuth, wallet, or funds).

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run preview
```

## Stack

Vite · React 18 · React Router · Tailwind CSS v4.
Fonts: Instrument Sans, Instrument Serif, Space Mono (open source, bundled).
