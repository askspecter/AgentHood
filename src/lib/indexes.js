/**
 * AURN Index Baskets - curated themes of tokenized Robinhood-Chain stocks.
 *
 * An "index coin" on AURN is a normal Pons coin (its own token, its own market)
 * that is *tagged* as tracking one of these baskets. AURN computes a live
 * reference NAV for the basket from the issuer's on-chain stock quotes, so a
 * creator (and every holder) can see, honestly and on-chain, what the theme the
 * coin is named after is actually doing.
 *
 * IMPORTANT (honesty): index coins are thematic tracking coins. They are NOT
 * collateralized by, backed by, or redeemable for the underlying stocks. The NAV
 * shown is a reference number built from live issuer quotes, nothing more.
 *
 * Constituents use symbols that exist in V2_QUOTE_TOKENS (real addresses on
 * Robinhood Chain), so every weight can be priced from the live directory.
 */

export const BASKETS = [
  {
    key: 'mag7',
    name: 'Magnificent 7',
    emoji: '🩸',
    tint: ['#b6cbee', '#43589f'],
    blurb: 'The seven mega-caps that carry the market. One coin, the whole megacap trade.',
    // Roughly cap-tilted, kept simple and transparent.
    constituents: [
      { symbol: 'NVDA', weight: 22 },
      { symbol: 'AAPL', weight: 16 },
      { symbol: 'MSFT', weight: 16 },
      { symbol: 'AMZN', weight: 14 },
      { symbol: 'GOOGL', weight: 12 },
      { symbol: 'META', weight: 12 },
      { symbol: 'TSLA', weight: 8 },
    ],
  },
  {
    key: 'ai',
    name: 'AI & Silicon',
    emoji: '🧠',
    tint: ['#c8b6ff', '#6a4bd0'],
    blurb: 'The chips and software powering the AI build-out.',
    constituents: [
      { symbol: 'NVDA', weight: 35 },
      { symbol: 'AMD', weight: 25 },
      { symbol: 'MU', weight: 15 },
      { symbol: 'PLTR', weight: 15 },
      { symbol: 'SNDK', weight: 10 },
    ],
  },
  {
    key: 'degen',
    name: 'Degen Desk',
    emoji: '🎰',
    tint: ['#ffd6a8', '#e0873f'],
    blurb: 'High-beta names the internet loves to trade. Volatile on purpose.',
    constituents: [
      { symbol: 'GME', weight: 30 },
      { symbol: 'COIN', weight: 30 },
      { symbol: 'CRCL', weight: 20 },
      { symbol: 'SPCX', weight: 20 },
    ],
  },
  {
    key: 'market',
    name: 'The Whole Market',
    emoji: '🌎',
    tint: ['#a8e6c8', '#3f9f6f'],
    blurb: 'The S&P 500 in a single token. The plain benchmark to beat.',
    constituents: [
      { symbol: 'SPY', weight: 100 },
    ],
  },
]

export const getBasket = (key) => BASKETS.find((b) => b.key === key) || null

/** Compact USD, feel.cash-style: $10.8K, $31.2K, $1.2M, $1.20. */
export function kusd(n) {
  if (n == null || !Number.isFinite(n)) return '-'
  const a = Math.abs(n)
  if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'
  if (a >= 1e3) return '$' + (n / 1e3).toFixed(2) + 'K'
  if (a >= 1) return '$' + n.toFixed(2)
  return '$' + n.toPrecision(2)
}
