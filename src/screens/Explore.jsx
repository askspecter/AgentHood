import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Discover — the real pons launch feed.
 *
 * Read straight off the pons factory's TokenLaunched event via /api/launches
 * (no sign-in, public on-chain data). Every card is a real token on Robinhood
 * Chain; tapping Trade opens it in the swap screen.
 */

const NETWORK = 'robinhood'
const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')

/** Compact USD like ponsfamily: $47.36M, $865.9k, $1,208. */
function compactUsd(n) {
  if (n == null || !Number.isFinite(n)) return null
  const abs = Math.abs(n)
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}k`
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}
function compactEth(n) {
  if (n == null || !Number.isFinite(n)) return null
  return `${Number(n).toLocaleString('en-US', { maximumFractionDigits: 4 })} Ξ`
}

const TABS = [
  { key: 'top', label: 'Top' },
  { key: 'new', label: 'New' },
  { key: 'graduated', label: 'Graduated' },
]

export default function Explore() {
  const [feed, setFeed] = useState(null)
  const [ethUsd, setEthUsd] = useState(null)
  const [explorer, setExplorer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('top')
  const [q, setQ] = useState('')

  const load = () => {
    setLoading(true)
    setError(null)
    fetch(`/api/launches?network=${NETWORK}&limit=24`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) { setError(json.hint ? `${json.error} ${json.hint}` : json.error); return }
        setFeed(json.launches || [])
        setEthUsd(json.ethUsd ?? null)
        setExplorer(json.explorer ?? null)
      })
      .catch(() => setError('Could not reach the launch feed.'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const list = useMemo(() => {
    let l = [...(feed || [])]
    if (q) {
      const s = q.toLowerCase()
      l = l.filter((c) => (c.name || '').toLowerCase().includes(s) || (c.symbol || '').toLowerCase().includes(s))
    }
    if (tab === 'graduated') l = l.filter((c) => c.graduated === true)
    if (tab === 'new') l.sort((a, b) => (b.blockNumber || 0) - (a.blockNumber || 0))
    else l.sort((a, b) => (b.marketCapWeth || 0) - (a.marketCapWeth || 0))
    return l
  }, [feed, tab, q])

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pt-1">
        <div>
          <h2 className="display text-3xl">Discover</h2>
          <p className="text-[var(--color-ink-soft)] text-sm mt-1">Top coins launched on pons · Robinhood Chain</p>
        </div>
        <div className="w-full sm:w-56">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search coins…" className="input" />
        </div>
      </div>

      <div className="seg no-scrollbar mb-5 flex overflow-x-auto max-w-full">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`shrink-0 ${tab === t.key ? 'on' : ''}`}>{t.label}</button>
        ))}
        <button onClick={load} disabled={loading} className="shrink-0 ml-auto">{loading ? '…' : '↻'}</button>
      </div>

      {error && <div className="chip chip-down w-full mb-4">{error}</div>}

      {loading && !feed ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="card p-4 h-56 animate-pulse opacity-40" />)}
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-ink-soft)]">
          {q ? `No coins match "${q}".` : 'No launches found in the scanned window.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {list.map((c) => <TokenCard key={c.token} c={c} ethUsd={ethUsd} explorer={explorer} />)}
        </div>
      )}
    </div>
  )
}

function Logo({ c }) {
  const [broken, setBroken] = useState(false)
  const letter = (c.symbol || c.name || '?').replace(/^\$/, '')[0]?.toUpperCase() || '?'
  if (c.logo && !broken) {
    return <img src={c.logo} alt="" onError={() => setBroken(true)}
      className="w-full aspect-square rounded-2xl object-cover" />
  }
  return (
    <div className="w-full aspect-square rounded-2xl grid place-items-center font-serif text-4xl"
      style={{ background: 'var(--holo)', color: '#0b0a12' }}>{letter}</div>
  )
}

function TokenCard({ c, ethUsd, explorer }) {
  const nav = useNavigate()
  const open = () => nav(`/trade?token=${c.token}`)
  const mcUsd = c.marketCapWeth != null && ethUsd ? c.marketCapWeth * ethUsd : null
  const mc = compactUsd(mcUsd) || compactEth(c.marketCapWeth) || '—'
  const sym = (c.symbol || 'TOKEN').replace(/^\$/, '')

  return (
    <div onClick={open} className="card card-hover p-3 cursor-pointer flex flex-col">
      <div className="relative mb-3">
        <Logo c={c} />
        {c.graduated === true && (
          <span className="absolute top-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/55 backdrop-blur text-white">Graduated</span>
        )}
      </div>

      <div className="font-semibold truncate">{c.name || `$${sym}`}</div>
      <div className="text-xs text-[var(--color-ink-soft)] font-mono">${sym}</div>

      <div className="mt-2 font-mono num">
        <span className="font-semibold">{mc}</span>
        <span className="text-[10px] text-[var(--color-ink-faint)] ml-1">MC</span>
      </div>

      <div className="flex items-center justify-between mt-1 text-[11px] text-[var(--color-ink-faint)] font-mono">
        <a href={explorer ? `${explorer}/token/${c.token}` : undefined} target="_blank" rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()} className="hover:text-[var(--color-ink-soft)]">{short(c.token)}</a>
        {typeof c.graduationProgress === 'number' && c.graduated !== true && (
          <span>{Math.round(c.graduationProgress * 100)}%</span>
        )}
      </div>

      <button onClick={(e) => { e.stopPropagation(); open() }}
        className="btn btn-holo static w-full mt-3 !py-2 text-sm">Trade</button>
    </div>
  )
}
