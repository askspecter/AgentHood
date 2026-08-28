import { useEffect, useRef, useState } from 'react'

/**
 * Live $AURN burn counter.
 *
 * Reads the on-chain burn total from /api/eska/burned (balance held at the burn
 * addresses, which can only ever climb) and shows it counting up — the visible
 * proof behind the deflationary story. Every creator claim tops up the buyback
 * reserve; the buyback swaps it for $AURN and sends it here to burn.
 */

const NETWORK = 'robinhood'

// Short, punchy formatting for a big burn number: 28.38M, 1.20B, 940.5K.
function fmtBurn(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  if (Math.abs(n) >= 1_000_000_000) return (n / 1e9).toFixed(2) + 'B'
  if (Math.abs(n) >= 1_000_000) return (n / 1e6).toFixed(2) + 'M'
  if (Math.abs(n) >= 1_000) return (n / 1e3).toFixed(1) + 'K'
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

// Ease a number from 0 → target over ~900ms so the counter animates in.
function useCountUp(target) {
  const [val, setVal] = useState(0)
  const raf = useRef(0)
  useEffect(() => {
    if (!Number.isFinite(target) || target <= 0) { setVal(target || 0); return }
    const start = performance.now()
    const from = 0
    const dur = 900
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur)
      const eased = 1 - Math.pow(1 - t, 3)
      setVal(from + (target - from) * eased)
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target])
  return val
}

export default function BurnCounter() {
  const [data, setData] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = () =>
      fetch(`/api/eska/burned?network=${NETWORK}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { if (!cancelled) { if (j && j.token && j.configured !== false && Number.isFinite(j.burned)) setData(j); else setFailed(true) } })
        .catch(() => { if (!cancelled) setFailed(true) })
    load()
    const id = setInterval(load, 60_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  const shown = useCountUp(data?.burned ?? 0)

  // Share the current burn total to X. eska.fun unfurls with the live burn card.
  const shareBurn = () => {
    const n = fmtBurn(data?.burned ?? 0)
    const text = `${n} $AURN burned and counting — bought back & burned on-chain, forever. deflationary by design.`
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent('https://eska.fun')}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // Nothing to show until the first read lands (and stay quiet if it can't read).
  if (failed && !data) return null
  if (!data) return null

  return (
    <div className="card relative overflow-hidden p-4 sm:p-5 mb-8">
      <div className="flex items-center gap-4">
        <span className="grid place-items-center w-11 h-11 rounded-xl panel-soft shrink-0" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 2.5c1.6 2.7 4.6 4 4.6 8.1a4.6 4.6 0 0 1-9.2 0c0-1.4.5-2.4 1.2-3.3.3 1 .9 1.7 1.7 2 0-2.1.6-4.7 1.7-6.8Z"
              fill="url(#flame)" />
            <path d="M12 12.5c.9 1 1.7 1.7 1.7 3a1.7 1.7 0 0 1-3.4 0c0-.8.4-1.2.8-1.8.1.4.4.7.7.8 0-.7.1-1.4.2-2Z" fill="#fff2c8" />
            <defs>
              <linearGradient id="flame" x1="12" y1="2.5" x2="12" y2="19" gradientUnits="userSpaceOnUse">
                <stop stopColor="#ffd45e" /><stop offset="0.55" stopColor="#ff8a3c" /><stop offset="1" stopColor="#ff4d6d" />
              </linearGradient>
            </defs>
          </svg>
        </span>

        <div className="flex-1 min-w-0">
          <div className="eyebrow">$AURN burned · deflationary</div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="display text-2xl sm:text-3xl num tabular-nums leading-none">{fmtBurn(shown)}</span>
            <span className="font-mono text-sm text-[var(--color-ink-faint)]">{data.symbol || 'AURN'}</span>
          </div>
        </div>

        <div className="hidden sm:flex flex-col items-end text-right shrink-0 mr-1">
          <div className="eyebrow">buyback &amp; burn</div>
          <div className="text-xs font-mono text-[var(--color-up)] mt-0.5">live · on-chain</div>
        </div>

        <button onClick={shareBurn} title="Share the burn on X"
          className="btn btn-secondary !py-2 !px-3 shrink-0 inline-flex items-center gap-1.5 text-sm">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M18.9 2H22l-7.5 8.6L23 22h-6.8l-5.3-6.9L4.8 22H1.7l8-9.2L1 2h7l4.8 6.3L18.9 2Zm-1.2 18h1.9L6.4 4H4.4l13.3 16Z" /></svg>
          Share
        </button>
      </div>
    </div>
  )
}
