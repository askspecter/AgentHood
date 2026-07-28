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

export default function CharmAvatar({ charm, size = 48, ring = false, square = false }) {
  const s = size
  const [c1, c2] = toneFor(charm)
  const letter = (charm.name?.[0] ?? 'E').toUpperCase()
  const [broken, setBroken] = useState(false)

  // A real token logo — a round image inside the sphere's footprint. If it fails
  // to load we fall through to the procedural sphere below (never a blank).
  if (charm.logo && !broken) {
    return (
      <div className="relative shrink-0" style={{ width: s, height: s }}>
        <img src={charm.logo} alt="" loading="lazy"
          style={{ width: s, height: s, borderRadius: '50%', objectFit: 'cover', background: `radial-gradient(120% 120% at 32% 24%, ${c1}, ${c2} 60%, #0b0a14 120%)`, boxShadow: ring ? '0 0 0 1px rgba(255,255,255,.14)' : undefined }}
          onError={() => setBroken(true)} />
        {charm.online && (
          <span className="absolute rounded-full" style={{ width: s * 0.16, height: s * 0.16, right: s * 0.04, bottom: s * 0.04, background: 'var(--color-up)', boxShadow: '0 0 0 2px #0a0912, 0 0 8px var(--color-up)' }} />
        )}
      </div>
    )
  }

  return (
    <div
      className="relative shrink-0 grid place-items-center select-none"
      style={{
        width: s, height: s,
        borderRadius: square ? Math.round(s * 0.28) : '50%',
        background: `radial-gradient(120% 120% at 32% 24%, ${c1} 0%, ${c2} 52%, #0b0a14 120%)`,
        boxShadow: `inset 0 ${s * 0.04}px ${s * 0.12}px rgba(255,255,255,0.45), inset 0 -${s * 0.06}px ${s * 0.14}px rgba(0,0,0,0.55), 0 ${s * 0.14}px ${s * 0.4}px -${s * 0.12}px ${c2}, ${ring ? '0 0 0 1px rgba(255,255,255,.14)' : '0 0 0 0 transparent'}`,
      }}
      aria-hidden
    >
      {/* specular highlight */}
      <span className="absolute rounded-full pointer-events-none"
        style={{ width: s * 0.42, height: s * 0.3, top: s * 0.1, left: s * 0.16, background: 'radial-gradient(closest-side, rgba(255,255,255,.85), transparent)', filter: 'blur(1px)', transform: 'rotate(-18deg)' }} />
      <span className="relative font-serif" style={{ fontSize: s * 0.44, color: 'rgba(255,255,255,.96)', textShadow: '0 1px 6px rgba(0,0,0,.4)', lineHeight: 1 }}>
        {letter}
      </span>
      {charm.online && (
        <span className="absolute rounded-full"
          style={{ width: s * 0.16, height: s * 0.16, right: s * 0.04, bottom: s * 0.04, background: 'var(--color-up)', boxShadow: '0 0 0 2px #0a0912, 0 0 8px var(--color-up)' }} />
      )}
    </div>
  )
}
