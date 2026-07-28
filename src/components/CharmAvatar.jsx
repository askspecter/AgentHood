// Editorial monogram — one muted ink tone per character, serif initial.
// A curated, low-saturation palette (no rainbow) keyed off the character hue.
export const TONES = [
  '#3b3a37', // near-black
  '#4a5158', // slate
  '#5c5347', // taupe
  '#455049', // sage
  '#6b5b52', // clay
  '#514b5a', // plum-grey
  '#4c5860', // steel
  '#605247', // umber
]
function toneFor(charm) {
  if (charm.tone) return charm.tone
  const key = (charm.id || charm.name || 'e')
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return TONES[h % TONES.length]
}

export default function CharmAvatar({ charm, size = 48, ring = false, square = false }) {
  const s = size
  const tone = toneFor(charm)
  const letter = (charm.name?.[0] ?? 'E').toUpperCase()
  return (
    <div
      className="relative shrink-0 grid place-items-center select-none"
      style={{
        width: s, height: s,
        borderRadius: square ? Math.round(s * 0.26) : '50%',
        background: tone,
        boxShadow: ring ? `0 0 0 1px var(--color-line)` : 'none',
        border: '1px solid rgba(255,255,255,.06)',
      }}
      aria-hidden
    >
      <span className="font-serif" style={{ fontSize: s * 0.46, color: 'rgba(255,255,255,.94)', lineHeight: 1 }}>
        {letter}
      </span>
      {charm.online && (
        <span className="absolute rounded-full"
          style={{ width: s * 0.16, height: s * 0.16, right: s * 0.04, bottom: s * 0.04, background: 'var(--color-up)', boxShadow: '0 0 0 2px var(--color-paper)' }} />
      )}
    </div>
  )
}
