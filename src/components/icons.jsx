export function Verified({ size = 16, gold = true }) {
  const fill = gold ? 'var(--color-accent)' : '#7f9cf5'
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="inline-block align-middle">
      <path
        fill={fill}
        d="M12 1.5l2.3 1.7 2.85-.2 1 2.68 2.5 1.37-.8 2.75.8 2.75-2.5 1.37-1 2.68-2.85-.2L12 22.5l-2.3-1.72-2.85.2-1-2.68-2.5-1.37.8-2.75-.8-2.75 2.5-1.37 1-2.68 2.85.2z"
      />
      <path fill="#fff" d="M10.6 15.2l-2.7-2.7 1.3-1.3 1.4 1.4 3.6-3.6 1.3 1.3z" />
    </svg>
  )
}

// small "mentions/holders" bubble icon
export function Mentions({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="inline-block align-middle" fill="none">
      <path
        d="M4 11.5C4 7.9 7.4 5 12 5s8 2.9 8 6.5S16.6 18 12 18c-.9 0-1.7-.1-2.5-.3L5 19l1-3.1C4.8 14.7 4 13.2 4 11.5z"
        fill="currentColor" opacity="0.9"
      />
    </svg>
  )
}

export function ArrowStat({ up, size = 18 }) {
  const bg = up ? 'var(--color-up)' : 'var(--color-down)'
  return (
    <span
      className="inline-grid place-items-center rounded-full text-white"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.62, lineHeight: 1 }}
    >
      {up ? '↑' : '↓'}
    </span>
  )
}

export function XGlyph({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M17.8 3h3.1l-6.9 7.9L22 21h-6.2l-4.8-6.3L5.4 21H2.3l7.4-8.5L2 3h6.3l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z" />
    </svg>
  )
}

export function XLogo({ size = 14 }) {
  return (
    <span
      className="inline-grid place-items-center rounded-full bg-black text-white border border-white/20"
      style={{ width: size + 10, height: size + 10 }}
    >
      <XGlyph size={size * 0.8} color="#fff" />
    </span>
  )
}

export function Info({ size = 34 }) {
  return (
    <span
      className="grid place-items-center rounded-full font-serif border"
      style={{
        width: size, height: size,
        background: 'rgba(255,255,255,.05)',
        borderColor: 'rgba(255,255,255,.18)',
        color: 'var(--color-ink)',
        fontSize: size * 0.52,
      }}
    >
      i
    </span>
  )
}

export function Crown({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
      <path d="M3 8l4 3 5-7 5 7 4-3-2 11H5z" />
    </svg>
  )
}

export function Search({ size = 20, stroke = 'var(--color-ink)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
    </svg>
  )
}

export function Gear({ size = 20, stroke = 'var(--color-ink)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5l1.4 2.2 2.6-.4.6 2.6 2.3 1.2-1 2.4 1 2.4-2.3 1.2-.6 2.6-2.6-.4L12 21.5l-1.4-2.2-2.6.4-.6-2.6-2.3-1.2 1-2.4-1-2.4 2.3-1.2.6-2.6 2.6.4z" />
    </svg>
  )
}

export function Gift({ size = 20, stroke = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
      <rect x="3" y="9" width="18" height="12" rx="1.5" /><path d="M3 13h18M12 9v12" />
      <path d="M12 9C11 5 8 4 7 6s1 3 5 3zM12 9c1-4 4-5 5-3s-1 3-5 3z" />
    </svg>
  )
}

export function Share({ size = 16, stroke = 'var(--color-ink)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
      <path d="M12 15V3M8 7l4-4 4 4M5 12v8h14v-8" />
    </svg>
  )
}

export function Back({ size = 22, stroke = 'var(--color-ink)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}

export function PlusSquare({ size = 20, stroke = 'var(--color-sky-deep)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
      <rect x="3" y="3" width="18" height="18" rx="4" /><path d="M12 8v8M8 12h8" />
    </svg>
  )
}

export function Coin({ size = 20, stroke = 'var(--color-ink)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8.5c-1.4 0-2.2.7-2.2 1.6 0 2 4.4 1 4.4 3 0 1-.9 1.7-2.2 1.7M12 7.5v9" strokeLinecap="round" />
    </svg>
  )
}

// generic settings-row line icon by name
const P = {
  editProfile: <><circle cx="10" cy="8" r="3.4" /><path d="M4 20c0-3.3 2.7-5 6-5 1 0 1.9.2 2.7.5" /><path d="M20 13l-5 5-2.5.6.6-2.6 5-5z" /></>,
  linkedSocials: <><path d="M9 13a4 4 0 006 0l2-2a4 4 0 10-5.6-5.6L10 7" /><path d="M15 11a4 4 0 00-6 0l-2 2a4 4 0 105.6 5.6L14 17" /></>,
  appearance: <><circle cx="12" cy="12" r="8.5" /><circle cx="8.5" cy="10" r="1" /><circle cx="12" cy="8" r="1" /><circle cx="15.5" cy="10" r="1" /><path d="M12 20.5c1.5 0 2-1 2-2s-1-1.6-1-2.6.9-1.4 2-1.4h1" /></>,
  gift: <><rect x="4" y="10" width="16" height="10" rx="1.5" /><path d="M4 13h16M12 10v10" /><path d="M12 10C11.2 7 9 6 8 7.5S9.5 10 12 10zM12 10c.8-3 3-4 4-2.5S14.5 10 12 10z" /></>,
  tos: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" strokeLinecap="round" /></>,
  privacy: <><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" strokeLinecap="round" /></>,
  x: <><path d="M5 5l14 14M19 5L5 19" strokeLinecap="round" /></>,
  support: <><path d="M5 13a7 7 0 0114 0" /><rect x="3.5" y="13" width="3.5" height="6" rx="1.5" /><rect x="17" y="13" width="3.5" height="6" rx="1.5" /></>,
  feedback: <><path d="M20 5H4v11h4v3l4-3h8z" strokeLinejoin="round" /></>,
  docs: <><path d="M4 5c3-1.5 5-1.5 8 0v14c-3-1.5-5-1.5-8 0zM20 5c-3-1.5-5-1.5-8 0v14c3-1.5 5-1.5 8 0z" strokeLinejoin="round" /></>,
  logout: <><path d="M14 4H6v16h8" /><path d="M18 12H10M15 9l3 3-3 3" strokeLinecap="round" /></>,
  wallet: <><rect x="3.5" y="6" width="17" height="13" rx="3" /><path d="M16 12h2" strokeLinecap="round" /></>,
}
export function RowIcon({ name, size = 20, stroke = 'var(--color-ink)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.9" strokeLinejoin="round">
      {P[name] ?? null}
    </svg>
  )
}

export function Chevron({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--color-ink-soft)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}
