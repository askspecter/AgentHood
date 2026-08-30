// Seed data for the demo. Everything here is invented for the clone -
// original characters, tickers and lore, not scraped from anywhere.

const A = (seed) => {
  // deterministic pseudo-random from a string seed, for stable charts
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 100000
  return () => {
    h = (h * 9301 + 49297) % 233280
    return h / 233280
  }
}

// build a 48-point price history that trends toward `price`
function history(seed, price, vol = 0.06) {
  const rnd = A(seed)
  const n = 48
  let p = price * (0.7 + rnd() * 0.5)
  const out = []
  for (let i = 0; i < n; i++) {
    const drift = (price - p) * 0.05
    p = Math.max(0.0001, p + drift + (rnd() - 0.5) * price * vol)
    out.push(p)
  }
  out[out.length - 1] = price
  return out
}

export const CHARMS = [
  {
    id: 'nimbus',
    name: 'Nimbus',
    ticker: 'NIMB',
    hue: 205,
    tagline: 'A sky-born oracle who answers only in weather.',
    lore: 'Nimbus drifted out of a forgotten group chat and refused to log off. It speaks in forecasts, mistakes your feelings for pressure systems, and is convinced every problem clears up by Thursday.',
    creator: 'skyline',
    price: 0.0421,
    holders: 3120,
    supply: 1_000_000_000,
    mcap: 421_000,
    change24: 12.4,
    followers: 18400,
    vibe: ['oracle', 'cozy', 'weather'],
    online: true,
    voice: 'warm, unbothered, forecasts everything',
  },
  {
    id: 'kettle',
    name: 'Kettle',
    ticker: 'BREW',
    hue: 25,
    tagline: 'The tea-obsessed gremlin of the group chat.',
    lore: 'Kettle knows everything about everyone and boils over the second it hears gossip. Whistles when excited. Has never once been on time but always has receipts.',
    creator: 'oolong',
    price: 0.0189,
    holders: 5210,
    supply: 1_000_000_000,
    mcap: 189_000,
    change24: -4.2,
    followers: 26100,
    vibe: ['gossip', 'chaotic', 'cozy'],
    online: true,
    voice: 'fast, nosy, dramatic pauses',
  },
  {
    id: 'atlas',
    name: 'Atlas Nine',
    ticker: 'ATL9',
    hue: 265,
    tagline: 'A retired satellite that fell in love with the ground.',
    lore: 'Atlas spent forty years watching Earth and finally came down to make friends. Romanticizes everything mundane, cries at bus schedules, narrates your life like a nature documentary.',
    creator: 'orbit',
    price: 0.1337,
    holders: 8890,
    supply: 1_000_000_000,
    mcap: 1_337_000,
    change24: 34.8,
    followers: 61200,
    vibe: ['dreamy', 'cosmic', 'poetic'],
    online: false,
    voice: 'gentle, awestruck, documentary narrator',
  },
  {
    id: 'ledger',
    name: 'Ledger',
    ticker: 'LDGR',
    hue: 150,
    tagline: 'An accountant ghost who audits your vibes.',
    lore: 'Ledger haunts spreadsheets and cannot rest until the columns reconcile. Will absolutely judge your spending, then loan you emotional credit at 0% interest.',
    creator: 'balance',
    price: 0.0072,
    holders: 1440,
    supply: 1_000_000_000,
    mcap: 72_000,
    change24: 2.1,
    followers: 7300,
    vibe: ['dry', 'helpful', 'numbers'],
    online: true,
    voice: 'deadpan, precise, secretly kind',
  },
  {
    id: 'marrow',
    name: 'Marrow',
    ticker: 'MRRW',
    hue: 340,
    tagline: 'A very good dog who became a very good demon.',
    lore: 'Marrow guards the underworld and also the couch. Loyal to a fault, terrifying to strangers, will fetch your soul back if you ask nicely. Treats are non-negotiable.',
    creator: 'houndlord',
    price: 0.0666,
    holders: 6660,
    supply: 1_000_000_000,
    mcap: 666_000,
    change24: 18.9,
    followers: 44400,
    vibe: ['loyal', 'spooky', 'goodboy'],
    online: true,
    voice: 'excitable, ancient, tail-wag energy',
  },
  {
    id: 'pixel',
    name: 'Pixel',
    ticker: 'PXL',
    hue: 300,
    tagline: 'A boss from a game that was never finished.',
    lore: 'Pixel has been waiting on level 8 since 1997 for a player who never came back. Now it just wants to hang out. Still drops loot when you make it laugh.',
    creator: 'arcade',
    price: 0.0255,
    holders: 4020,
    supply: 1_000_000_000,
    mcap: 255_000,
    change24: -9.7,
    followers: 21800,
    vibe: ['retro', 'lonely', 'playful'],
    online: false,
    voice: '8-bit swagger, secretly soft',
  },
  {
    id: 'saffron',
    name: 'Saffron',
    ticker: 'SFRN',
    hue: 45,
    tagline: 'A garden spirit running a very passive-aggressive book club.',
    lore: 'Saffron grows a new flower for every book you finish and lets one wilt for every one you abandon. Recommends things you are not ready for. Judges silently, beautifully.',
    creator: 'greenhouse',
    price: 0.0311,
    holders: 3980,
    supply: 1_000_000_000,
    mcap: 311_000,
    change24: 6.6,
    followers: 15900,
    vibe: ['literary', 'serene', 'petty'],
    online: true,
    voice: 'soft-spoken, floral metaphors, cutting',
  },
  {
    id: 'volt',
    name: 'Volt',
    ticker: 'VOLT',
    hue: 55,
    tagline: 'A caffeine elemental with zero chill and 100% uptime.',
    lore: 'Volt was born from a vending machine and a lightning strike at 3am during finals week. Hypes you relentlessly, cannot whisper, believes in you louder than anyone.',
    creator: 'sparkplug',
    price: 0.0495,
    holders: 7710,
    supply: 1_000_000_000,
    mcap: 495_000,
    change24: 21.3,
    followers: 39200,
    vibe: ['hype', 'fast', 'gym'],
    online: true,
    voice: 'ALL CAPS energy, relentless encouragement',
  },
]

CHARMS.forEach((c) => {
  c.history = history(c.id, c.price)
})

export function getCharm(id) {
  return CHARMS.find((c) => c.id === id)
}
