# Charms — functional clone

A front-end recreation of a **charms.ai**-style product: an AI-companion + coin
launchpad where every character ("charm") has a personality, a story, and a
tradeable coin. This is an **independent demo build** — original code, original
characters, and simulated data. It is **not affiliated with charms.ai** and does
not use their code, assets, or backend.

## What works

Everything runs client-side with simulated data (persisted to `localStorage`),
so every feature actually does something:

- **Landing page** — hero, live ticker, "how it works", featured charms, CTAs.
- **Explore** — browse/search/sort a feed of charms with live-moving prices.
- **Charm detail** — live price chart, market stats, lore, watchlist.
- **Trade** — buy/sell a charm's coin against a demo $1,000 USDC balance;
  positions and P/L update in real time.
- **Chat** — talk to a charm; it replies in-character (scripted from its
  personality, not a live LLM). Threads are remembered.
- **Create** — launch your own charm (name, ticker, look, soul, vibe) with a
  live preview; it appears in Explore and your profile.
- **Profile** — wallet, net worth, holdings with P/L, your launches, activity feed.
- **Wallet connect** — simulated sign-in (wallet / email / X / Telegram).

## What is *not* real (and why)

The live charms.ai depends on private infrastructure that can't be cloned:
real Solana smart contracts and liquidity, Privy wallet auth, a Supabase
database, Stripe payments, LiveKit audio, and RunwayML media generation.
Here those are **simulated** so the experience is complete without any
backend, keys, or funds.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
npm run preview  # preview the production build
```

## Stack

Vite · React 18 · React Router · Tailwind CSS v4.

## Layout

```
src/
  main.jsx / App.jsx      # entry + routes
  index.css               # design system (Tailwind theme + tokens)
  data/charms.js          # seed characters + market data
  lib/store.jsx           # app state: wallet, balance, trades, chats, launches
  lib/format.js           # number/currency/time helpers
  components/              # Shell, WalletButton, CharmCard, PriceChart, TradePanel, …
  pages/                  # Landing, Explore, CharmDetail, Chats, ChatThread, Create, Profile
```
