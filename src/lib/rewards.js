/**
 * $AURN holder rewards.
 *
 * Holding $AURN earns a share of each epoch's reward pool — $PONS plus a basket
 * of tokenized Robinhood-Chain stocks — distributed pro-rata to your share of
 * supply. This module holds the pool config and the pure math; the Rewards page
 * reads a wallet's live $AURN balance and previews what it earns.
 *
 * Figures are estimates from the current pool; the live distributor tops the
 * pool up each epoch. AURN is non-custodial — nothing here touches a key.
 */

// The official $AURN token on Robinhood Chain (matches the app's default pin).
export const AURN_TOKEN_FALLBACK = '0x15157A4380a357Fc307Ee39A4A476bE5ec8D2E74'

// Rewards are split across the full fixed supply, so your share = your balance / supply.
export const REWARD_SUPPLY = 1_000_000_000

// One reward epoch = one week, anchored to a fixed Monday 00:00 UTC.
export const EPOCH_MS = 7 * 24 * 60 * 60 * 1000
const EPOCH_ANCHOR = Date.UTC(2025, 0, 6, 0, 0, 0)

/** What the current epoch distributes to holders. `pool` is the whole-epoch pool. */
export const REWARD_POOL = [
  { key: 'PONS', label: '$PONS', sub: 'Pons protocol token', pool: 750_000, unit: '', tint: ['#cdd9f2', '#5f79c6'] },
  { key: 'NVDA', label: 'NVDA', sub: 'NVIDIA', pool: 14, unit: 'sh', tint: ['#b6cbee', '#43589f'] },
  { key: 'TSLA', label: 'TSLA', sub: 'Tesla', pool: 9, unit: 'sh', tint: ['#e6eefc', '#7f9bcf'] },
  { key: 'AAPL', label: 'AAPL', sub: 'Apple', pool: 18, unit: 'sh', tint: ['#dbe7ff', '#8fb0e6'] },
  { key: 'SPY', label: 'SPY', sub: 'S&P 500 ETF', pool: 6, unit: 'sh', tint: ['#9fb8e2', '#4a5f9c'] },
  { key: 'COIN', label: 'COIN', sub: 'Coinbase', pool: 11, unit: 'sh', tint: ['#c3ccdf', '#6f8bd0'] },
]

/** Current epoch window + how long is left in it. */
export function epochInfo(now = Date.now()) {
  const idx = Math.floor((now - EPOCH_ANCHOR) / EPOCH_MS)
  const start = EPOCH_ANCHOR + idx * EPOCH_MS
  const end = start + EPOCH_MS
  return { idx, start, end, msLeft: Math.max(0, end - now), progress: Math.min(1, Math.max(0, (now - start) / EPOCH_MS)) }
}

/** A holder's fraction of supply, clamped to [0, 1]. */
export function shareOf(balance) {
  const b = Number(balance)
  if (!Number.isFinite(b) || b <= 0) return 0
  return Math.min(1, b / REWARD_SUPPLY)
}

/** Per-token reward preview for a given $AURN balance. */
export function rewardsFor(balance) {
  const share = shareOf(balance)
  return REWARD_POOL.map((r) => ({ ...r, share, amount: r.pool * share }))
}

/** Compact reward-amount formatting that keeps small fractions readable. */
export function fmtReward(n) {
  const a = Math.abs(Number(n) || 0)
  if (a === 0) return '0'
  if (a >= 1000) return Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })
  if (a >= 1) return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (a >= 0.0001) return Number(n).toFixed(4)
  return Number(n).toExponential(2)
}

/** ms → "3d 4h 12m" style countdown. */
export function fmtCountdown(ms) {
  if (ms <= 0) return 'distributing…'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (d >= 1) return `${d}d ${h}h ${m}m`
  if (h >= 1) return `${h}h ${m}m ${sec}s`
  return `${m}m ${sec}s`
}
