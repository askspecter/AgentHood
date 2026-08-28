import { useEffect, useRef, useState } from 'react'

// Live area chart that appends the current live price each tick.
export default function PriceChart({ seed = [], live, up = true, height = 220 }) {
  const clean = (arr) => arr.filter((v) => Number.isFinite(v))
  const [series, setSeries] = useState(() => clean(seed).slice(-60))
  const width = 640

  useEffect(() => {
    // Only append a real, finite live price — a 0/undefined tick would flatten
    // or break (NaN path → invisible) the whole line.
    if (!Number.isFinite(live) || live <= 0) return
    setSeries((s) => [...s, live].slice(-60))
  }, [live])

  // Never bail to a blank box: a coin with no price history still gets a flat
  // baseline so the chart area reads as a chart, not an empty panel.
  const data = series.length >= 2 ? series : [1, 1]
  const min = Math.min(...data)
  const max = Math.max(...data)
  const flat = max === min
  const range = max - min || 1
  const step = width / (data.length - 1)
  // A flat series draws through the middle; otherwise scale into the band.
  const pts = data.map((v, i) => [i * step, flat ? height / 2 : height - ((v - min) / range) * (height - 24) - 12])
  const d = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
  const color = up ? 'var(--color-up)' : 'var(--color-down)'
  const last = pts[pts.length - 1]

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="pc" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.22" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1="0" x2={width} y1={height * g} y2={height * g} stroke="var(--color-line)" strokeWidth="1" />
      ))}
      <path d={`${d} L ${width} ${height} L 0 ${height} Z`} fill="url(#pc)" />
      <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="4" fill={color} />
      <circle cx={last[0]} cy={last[1]} r="8" fill={color} opacity="0.25">
        <animate attributeName="r" values="6;12;6" dur="1.6s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.35;0;0.35" dur="1.6s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}
