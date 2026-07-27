export default function CharmAvatar({ charm, size = 48, ring = false, shape = 'circle', showStatus = false }) {
  const s = size
  const bg = `linear-gradient(150deg, hsl(${charm.hue} 90% 84%), hsl(${(charm.hue + 45) % 360} 82% 66%))`
  const radius = shape === 'circle' ? '50%' : s * 0.32
  return (
    <div
      className="relative shrink-0 grid place-items-center"
      style={{
        width: s, height: s,
        borderRadius: radius,
        background: bg,
        boxShadow: ring
          ? `0 0 0 4px rgba(255,255,255,.9), 0 12px 26px -10px hsl(${charm.hue} 70% 45% / .6)`
          : '0 6px 16px -8px rgba(20,32,59,.4)',
        fontSize: s * 0.5,
      }}
      aria-hidden
    >
      <span style={{ filter: 'saturate(1.1)' }}>{charm.emoji}</span>
      {showStatus && charm.online && (
        <span
          className="absolute rounded-full bg-[var(--color-up)] border-2 border-white"
          style={{ width: s * 0.22, height: s * 0.22, right: s * 0.02, bottom: s * 0.02 }}
        />
      )}
    </div>
  )
}
