// Cinematic monogram orb: dual-hue radial gradient, hairline ring, soft glow.
export default function CharmAvatar({ charm, size = 48, ring = false }) {
  const s = size
  const h = charm.hue ?? 40
  const letter = (charm.name?.[0] ?? 'E').toUpperCase()
  return (
    <div
      className="relative shrink-0 grid place-items-center select-none"
      style={{
        width: s, height: s, borderRadius: '50%',
        background: `radial-gradient(120% 120% at 30% 22%,
          hsl(${h} 65% 52% / .95) 0%,
          hsl(${(h + 50) % 360} 70% 26%) 55%,
          #07080d 120%)`,
        boxShadow: ring
          ? `0 0 0 1px rgba(255,255,255,.28), 0 0 ${s * 0.6}px -${s * 0.12}px hsl(${h} 80% 55% / .65)`
          : `inset 0 0 0 1px rgba(255,255,255,.14), 0 ${s * 0.16}px ${s * 0.5}px -${s * 0.2}px hsl(${h} 80% 45% / .55)`,
      }}
      aria-hidden
    >
      <span
        className="font-serif"
        style={{
          fontSize: s * 0.46,
          color: 'rgba(255,255,255,.92)',
          textShadow: '0 1px 8px rgba(0,0,0,.5)',
          lineHeight: 1,
        }}
      >
        {letter}
      </span>
      {charm.online && (
        <span
          className="absolute rounded-full"
          style={{
            width: s * 0.18, height: s * 0.18, right: s * 0.02, bottom: s * 0.02,
            background: 'var(--color-up)',
            boxShadow: '0 0 0 2px #05060a, 0 0 10px rgba(63,214,143,.8)',
          }}
        />
      )}
    </div>
  )
}
