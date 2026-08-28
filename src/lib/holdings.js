/**
 * Shared held-token reader with a short cache.
 *
 * The portfolio scan is the heaviest read in the app, so the Send and Trade
 * pickers must not each pay for it fresh. This keeps the last result in memory
 * (and sessionStorage, so it survives a reload) and hands it back instantly
 * while a background refresh runs — the same "paint now, reconcile after" shape
 * the balance uses. The server already caches the scan for ~45s, so the
 * background refresh is cheap too.
 */

const KEY = 'aurn.holdings.v1'
const TTL_MS = 60_000
let mem = null // { at, holdings }

function readPersisted() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const j = JSON.parse(raw)
    if (!j || !Array.isArray(j.holdings)) return null
    return j
  } catch {
    return null
  }
}

/**
 * The freshest holdings we already have, or null. Never hits the network.
 * Persisted to localStorage so the very first paint on a fresh page load is
 * instant (stale-while-revalidate — loadHoldings still refetches behind it).
 */
export function cachedHoldings() {
  if (mem) return mem.holdings
  const s = readPersisted()
  if (s) { mem = s; return s.holdings }
  return null
}

function store(holdings) {
  mem = { at: Date.now(), holdings }
  try { localStorage.setItem(KEY, JSON.stringify(mem)) } catch {}
  return holdings
}

/**
 * Fetch the wallet's held tokens.
 *
 * @param {(h: any[]) => void} onData called with cached data immediately (if any)
 *   and again with fresh data once the scan returns.
 * @returns {() => void} cancel — stops the fresh result from landing after unmount.
 */
export function loadHoldings(onData) {
  let cancelled = false
  const cached = cachedHoldings()
  if (cached) onData(cached)

  // Skip the network entirely when the in-memory copy is still warm.
  if (mem && Date.now() - mem.at < TTL_MS) return () => { cancelled = true }

  fetch('/api/terminal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: 'portfolio', network: 'robinhood' }),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      if (cancelled) return
      const holdings = j?.data?.holdings || []
      store(holdings)
      onData(holdings)
    })
    .catch(() => { if (!cancelled && !cached) onData([]) })

  return () => { cancelled = true }
}

/** Seed the cache from a portfolio read done elsewhere (e.g. the Profile page). */
export function primeHoldings(holdings) {
  if (Array.isArray(holdings)) store(holdings)
}

/** Drop the cache — call after a trade/send so the next read rescans. */
export function invalidateHoldings() {
  mem = null
  try { localStorage.removeItem(KEY) } catch {}
}
