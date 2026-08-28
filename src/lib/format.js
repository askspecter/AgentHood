export function usd(n, opts = {}) {
  const { max = 2 } = opts
  if (n == null || isNaN(n)) return '$0.00'
  if (Math.abs(n) >= 1_000_000_000) return '$' + (n / 1e9).toFixed(2) + 'B'
  if (Math.abs(n) >= 1_000_000) return '$' + (n / 1e6).toFixed(2) + 'M'
  if (Math.abs(n) >= 1_000) return '$' + (n / 1e3).toFixed(1) + 'K'
  if (n !== 0 && Math.abs(n) < 1) {
    // Tiny prices ($0.0000047) need extra precision or they collapse to $0.00.
    const digits = Math.min(18, Math.max(4, 2 - Math.floor(Math.log10(Math.abs(n)))))
    return '$' + n.toFixed(digits).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
  }
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: max })
}

// account balances — clean dollars, no forced 4-decimal prices
export function bal(n) {
  if (n == null || isNaN(n)) return '$0'
  return '$' + n.toLocaleString(undefined, { maximumFractionDigits: Math.abs(n % 1) > 0 ? 2 : 0 })
}

export function num(n) {
  if (n == null) return '0'
  if (Math.abs(n) >= 1_000_000) return (n / 1e6).toFixed(1) + 'M'
  if (Math.abs(n) >= 1_000) return (n / 1e3).toFixed(1) + 'K'
  return String(Math.round(n))
}

export function pct(n) {
  const s = n >= 0 ? '+' : ''
  return s + n.toFixed(1) + '%'
}

export function timeAgo(ts) {
  const d = Math.floor((Date.now() - ts) / 1000)
  if (d < 60) return d + 's'
  if (d < 3600) return Math.floor(d / 60) + 'm'
  if (d < 86400) return Math.floor(d / 3600) + 'h'
  return Math.floor(d / 86400) + 'd'
}
