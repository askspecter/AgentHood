/**
 * Token locks - a per-wallet record of supply the holder has committed to lock
 * for a fixed term, with a live countdown to unlock.
 *
 * Stored locally per connected wallet (AURN is non-custodial, so nothing here
 * touches a private key). On-chain time-lock enforcement activates once a locker
 * contract is wired for Robinhood Chain; until then this is the holder's own
 * lock record and countdown.
 */

const DAY = 86_400_000

export const DURATIONS = [
  { key: '1d', label: '1 day', ms: 1 * DAY },
  { key: '1w', label: '1 week', ms: 7 * DAY },
  { key: '2w', label: '2 weeks', ms: 14 * DAY },
  { key: '1mo', label: '1 month', ms: 30 * DAY },
  { key: '3mo', label: '3 months', ms: 90 * DAY },
  { key: '6mo', label: '6 months', ms: 180 * DAY },
  { key: '1y', label: '1 year', ms: 365 * DAY },
  { key: '2y', label: '2 years', ms: 730 * DAY },
]

const KEY = 'aurn.locks.v1'

function readAll() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} }
}
function writeAll(obj) {
  try { localStorage.setItem(KEY, JSON.stringify(obj)) } catch {}
}

/** All locks for a wallet, soonest-to-unlock first. */
export function getLocks(wallet) {
  if (!wallet) return []
  const all = readAll()
  return (all[wallet.toLowerCase()] || []).slice().sort((a, b) => a.unlockAt - b.unlockAt)
}

export function addLock(wallet, lock) {
  if (!wallet) return null
  const w = wallet.toLowerCase()
  const all = readAll()
  const id = (globalThis.crypto?.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2)))
  const rec = { id, ...lock }
  all[w] = [...(all[w] || []), rec]
  writeAll(all)
  return rec
}

export function removeLock(wallet, id) {
  if (!wallet) return
  const w = wallet.toLowerCase()
  const all = readAll()
  all[w] = (all[w] || []).filter((l) => l.id !== id)
  writeAll(all)
}

/** Format a remaining-duration (ms) as a compact countdown. */
export function fmtCountdown(ms) {
  if (ms <= 0) return 'Ready to unlock'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (d >= 1) return `${d}d ${h}h ${m}m`
  if (h >= 1) return `${h}h ${m}m ${sec}s`
  if (m >= 1) return `${m}m ${sec}s`
  return `${sec}s`
}

/** A friendly absolute unlock date. */
export function fmtDate(ts) {
  try {
    return new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return new Date(ts).toISOString()
  }
}
