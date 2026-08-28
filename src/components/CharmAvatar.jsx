import { useState } from 'react'

// Glossy glass sphere with a specular highlight and colored core.
export const TONES = [
  ['#8b7bff', '#4b3fae'], // violet
  ['#38d6ee', '#1c7f97'], // cyan
  ['#ff8fb0', '#a83f63'], // rose
  ['#7de0a6', '#2f7d55'], // mint
  ['#ffd27d', '#a8722f'], // amber
  ['#b79bff', '#6042b0'], // lilac
  ['#7db4ff', '#2f5ea8'], // azure
  ['#ff9d7d', '#a8522f'], // coral
]
export function toneFor(charm) {
  if (Array.isArray(charm.tone)) return charm.tone
  const key = charm.id || charm.name || 'e'
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return TONES[h % TONES.length]
}

export default function CharmAvatar({ charm, size = 48, ring = false }) {
  const s = size
  const [c1, c2] = toneFor(charm)
  const letter = (charm.name?.[0] ?? 'A').toUpperCase()
  const [broken, setBroken] = useState(false)
  const radius = Math.round(s * 0.24) // rounded square — a flat tile, never a ball
  const ringShadow = ring ? 'inset 0 0 0 1px rgba(210,224,255,.14)' : undefined

  // A real token logo — a square image in the tile's footprint. If it fails to
  // load we fall through to the flat lettered tile below (never a blank).
  if (charm.logo && !broken) {
    return (
      <div className="relative shrink-0" style={{ width: s, height: s }}>
        <img src={charm.logo} alt="" loading="lazy"
          style={{ width: s, height: s, borderRadius: radius, objectFit: 'cover', boxShadow: ringShadow }}
          onError={() => setBroken(true)} />
      </div>
    )
  }

  return (
    <div
      className="relative shrink-0 grid place-items-center select-none overflow-hidden"
      style={{
        width: s, height: s,
        borderRadius: radius,
        // Flat diagonal gradient — a coloured tile, not a glossy sphere.
        background: `linear-gradient(145deg, ${c1} 0%, ${c2} 100%)`,
        boxShadow: ringShadow,
      }}
      aria-hidden
    >
      <span className="relative font-serif" style={{ fontSize: s * 0.46, color: 'rgba(255,255,255,.96)', textShadow: '0 1px 4px rgba(0,0,0,.28)', lineHeight: 1 }}>
        {letter}
      </span>
    </div>
  )
}
