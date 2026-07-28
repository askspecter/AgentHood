// Soft monogram tile — muted duo-tone gradient, subtle inner ring.
export default function CharmAvatar({ charm, size = 48, ring = false, square = false }) {
  const s = size
  const h = charm.hue ?? 240
  const letter = (charm.name?.[0] ?? 'E').toUpperCase()
  return (
    <div
      className="relative shrink-0 grid place-items-center select-none"
      style={{
        width: s, height: s,
        borderRadius: square ? s * 0.3 : '50%',
        background: `linear-gradient(145deg,
          hsl(${h} 42% 62%) 0%,
          hsl(${(h + 35) % 360} 40% 48%) 100%)`,
        boxShadow: ring
          ? `0 0 0 4px #fff, 0 8px 24px -8px hsl(${h} 40% 45% / .5)`
          : `inset 0 0 0 1px rgba(255,255,255,.25)`,
      }}
      aria-hidden
    >
      <span
        className="font-serif"
        style={{ fontSize: s * 0.44, color: 'rgba(255,255,255,.96)', lineHeight: 1 }}
      >
        {letter}
      </span>
      {charm.online && (
        <span
          className="absolute rounded-full"
          style={{
            width: s * 0.2, height: s * 0.2, right: s * 0.02, bottom: s * 0.02,
            background: 'var(--color-up)', boxShadow: '0 0 0 2px #fff',
          }}
        />
      )}
    </div>
  )
}
