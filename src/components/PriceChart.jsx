import { useEffect, useRef, useState } from 'react'

// Live area chart that appends the current live price each tick.
export default function PriceChart({ seed = [], live, up = true, height = 220 }) {
  const clean = (arr) => arr.filter((v) => Number.isFinite(v) && v > 0)
  const [series, setSeries] = useState(() => clean(seed).slice(-60))
  const width = 640

  const median = (arr) => {
    if (!arr.length) return 0
    const s = [...arr].sort((a, b) => a - b)
    return s[Math.floor(s.length / 2)] || 0
  }

  useEffect(() => {
    // Only append a real, finite live price - a 0/undefined tick would flatten
    // or break (NaN path → invisible) the whole line.
    if (!Number.isFinite(live) || live <= 0) return
    setSeries((s) => {
      if (!s.length) return [live, live]
      // Guard against a scale mismatch: the synthetic seed can be generated on a
      // different price scale than the real live price (e.g. a placeholder base
      // of 1 vs a $0.00007 token). Appending across scales would render as a
      // cliff to the floor. When live is wildly off the series' scale, sit flat
      // at the real price instead of drawing a plunge.
      const med = median(s)
      if (med > 0 && (live > med * 4 || live < med / 4)) return Array(Math.min(s.length, 40) || 2).fill(live)
      return [...s, live].slice(-60)
    })
  }, [live])

  // Never bail to a blank box: a coin with no price history still gets a flat
  // baseline so the chart area reads as a chart, not an empty panel.
  const raw = series.length >= 2 ? series : (Number.isFinite(live) && live > 0 ? [live, live] : [1, 1])
  // Winsorize to a robust band around the median so a single stray point (an
  // off-scale seed value or a bad tick) can't render as a cliff, while a real
  // ±40% move still shows in full.
  const med = median(raw) || 1
  const data = raw.map((v) => Math.min(med * 3, Math.max(med * 0.3, v)))
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min
  // Floor the range so a nearly-flat series (tiny % moves) reads as a calm line
  // rather than having its noise amplified to fill the whole chart. A real swing
  // (span bigger than the floor) still uses its own full detail.
  const range = Math.max(span, Math.abs(max) * 0.18) || 1
  const mid = (min + max) / 2
  const step = width / (data.length - 1)
  // Center the band around the series midpoint so a gentle line sits mid-height.
  const pts = data.map((v, i) => [i * step, height / 2 - ((v - mid) / range) * (height - 28)])
  const d = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
  // AURN glow - a luminous cold-white line (no red/green), lit by a soft blue
  // halo, regardless of the 24h direction.
  const line = '#eaf1ff'
  const halo = '#9fb8e2'
  const fillTop = '#bcd0f4'
  const last = pts[pts.length - 1]

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="pc" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={fillTop} stopOpacity="0.20" />
          <stop offset="1" stopColor={fillTop} stopOpacity="0" />
        </linearGradient>
        <filter id="pcglow" x="-10%" y="-40%" width="120%" height="180%">
          <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor={halo} floodOpacity="0.9" />
        </filter>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1="0" x2={width} y1={height * g} y2={height * g} stroke="var(--color-line)" strokeWidth="1" />
      ))}
      <path d={`${d} L ${width} ${height} L 0 ${height} Z`} fill="url(#pc)" />
      <path d={d} fill="none" stroke={line} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" filter="url(#pcglow)" />
      <circle cx={last[0]} cy={last[1]} r="4" fill={line} filter="url(#pcglow)" />
      <circle cx={last[0]} cy={last[1]} r="8" fill={line} opacity="0.25">
        <animate attributeName="r" values="6;12;6" dur="1.6s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.35;0;0.35" dur="1.6s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}
