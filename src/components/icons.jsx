export function Verified({ size = 16, gold = false }) {
  const fill = gold ? '#f4a419' : '#2f7dff'
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

export function XLogo({ size = 14 }) {
  return (
    <span
      className="inline-grid place-items-center rounded-full bg-black text-white"
      style={{ width: size + 8, height: size + 8, fontSize: size * 0.9 }}
    >
      𝕏
    </span>
  )
}

export function Info({ size = 34 }) {
  return (
    <span
      className="grid place-items-center rounded-full font-serif"
      style={{ width: size, height: size, background: 'var(--color-ink)', color: '#fff', fontSize: size * 0.5 }}
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
