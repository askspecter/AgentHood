export default function CharmAvatar({ charm, size = 48, ring = false }) {
  const s = size
  const bg = `linear-gradient(135deg, hsl(${charm.hue} 85% 82%), hsl(${(charm.hue + 40) % 360} 80% 68%))`
  return (
    <div
      className="relative shrink-0 grid place-items-center"
      style={{
        width: s, height: s,
        borderRadius: s * 0.32,
        background: bg,
        boxShadow: ring ? `0 0 0 3px #fff, 0 8px 20px -8px hsl(${charm.hue} 70% 50% / .6)` : '0 6px 16px -8px rgba(20,32,59,.4)',
        fontSize: s * 0.5,
      }}
      aria-hidden
    >
      <span style={{ filter: 'saturate(1.1)' }}>{charm.emoji}</span>
      {charm.online && (
        <span
          className="absolute rounded-full bg-[var(--color-up)] border-2 border-white"
          style={{ width: s * 0.24, height: s * 0.24, right: -2, bottom: -2 }}
        />
      )}
    </div>
  )
}
