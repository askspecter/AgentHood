export function Verified({ size = 16, gold = false }) {
  // Gold seal with a white check for the official token ($ESKA); the plain ink
  // seal (with a paper-coloured check cut out) for everyone else.
  const seal = gold ? '#f5b81c' : 'var(--color-ink)'
  const check = gold ? '#0b0a12' : 'var(--color-paper)'
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" className="inline-block align-middle" aria-hidden="true">
      <path
        fill={seal}
        d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816z"
      />
      <path fill={check} d="M9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
    </svg>
  )
}

// small "holders" chat-bubble icon
export function Mentions({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="inline-block align-middle" fill="none"
      stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round">
      <path d="M20 11.5c0 3.6-3.6 6.5-8 6.5-1 0-1.9-.1-2.8-.4L4.5 19l1.2-3.7A6 6 0 0 1 4 11.5C4 7.9 7.6 5 12 5s8 2.9 8 6.5z" />
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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
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
      <circle cx="12" cy="12" r="9" /><path d="M14.6 9.2c-.5-.9-1.5-1.4-2.6-1.4-1.5 0-2.6.8-2.6 2 0 2.7 5.4 1.3 5.4 4 0 1.3-1.1 2.1-2.8 2.1-1.2 0-2.2-.5-2.8-1.4M12 6.3v11.4" strokeLinecap="round" />
    </svg>
  )
}

// generic settings-row line icon by name
const P = {
  editProfile: <><circle cx="10" cy="8" r="3.4" /><path d="M4 20c0-3.3 2.7-5 6-5 1 0 1.9.2 2.7.5" /><path d="M20 13l-5 5-2.5.6.6-2.6 5-5z" /></>,
  linkedSocials: <><path d="M9 13a4 4 0 006 0l2-2a4 4 0 10-5.6-5.6L10 7" /><path d="M15 11a4 4 0 00-6 0l-2 2a4 4 0 105.6 5.6L14 17" /></>,
  leaderboard: <><rect x="4" y="12" width="4" height="8" rx="1" /><rect x="10" y="7" width="4" height="13" rx="1" /><rect x="16" y="14" width="4" height="6" rx="1" /></>,
  appearance: <><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none" /></>,
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
