# AURN

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
- **Locked**: time-lock tokens you hold on Robinhood Chain in the on-chain
  AurnLocker contract, and browse the public registry of locked tokens (see below).
- **Sign in** — X only (simulated; no real OAuth, wallet, or funds).

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run preview
```

## Locked (on-chain token locks)

Settings → Locked is a non-custodial ERC-20 time-lock backed by the
`AurnLocker` smart contract (`contracts/AurnLocker.sol`).

- **Lock / unlock** are signed by the token owner's own wallet. Tokens move into
  the contract for a fixed term, and only the owner can withdraw them, only after
  the term ends. AURN never takes custody.
- **The list of locked tokens is public.** The API route `app/api/locks/route.js`
  reads the contract's views server-side over RPC, so anyone can see which tokens
  are locked, the amount, the owner, and the unlock time on the Locked page
  without connecting a wallet.

To make it live:

1. Deploy the contract. Locally with a funded deployer key:
   `PRIVATE_KEY=0x… node scripts/deploy-locker.mjs`, or run the
   **Deploy Locker** GitHub Actions workflow (uses the `DEPLOYER_PRIVATE_KEY`
   repository secret so the key never leaves CI).
2. Set the printed address as `NEXT_PUBLIC_LOCKER_ADDRESS` in the app env
   (Vercel → Environment Variables) and redeploy.

Until `NEXT_PUBLIC_LOCKER_ADDRESS` is set, the Locked page falls back to a
local-only preview and shows a "not deployed yet" note.

## Stack

Vite · React 18 · React Router · Tailwind CSS v4.
Fonts: Instrument Sans, Instrument Serif, Space Mono (open source, bundled).
