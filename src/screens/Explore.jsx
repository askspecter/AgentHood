import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import CharmAvatar from '../components/CharmAvatar'
import { Verified } from '../components/icons'

/**
 * Home - a feel.cash-style front: a swipeable hero carousel of top coins, an
 * "Explore coins" grid of image-forward cards, and quick filter chips. The
 * market is quiet by default; it fills only with coins launched through AURN.
 */

const TABS = [
  { key: 'trending', label: 'Trending' },
  { key: 'stock', label: 'Stock Paired' },
  { key: 'gainers', label: 'Top Gainers' },
  { key: 'new', label: 'New' },
]

const capOf = (c) => (Number.isFinite(c.mcap) && c.mcap > 0 ? c.mcap : (Number.isFinite(c.marketCapWeth) ? c.marketCapWeth : 0))

/** Compact USD, feel.cash-style: $10.8K, $31.2K, $1.2M. */
function kusd(n) {
  if (n == null || !Number.isFinite(n)) return '-'
  const a = Math.abs(n)
  if (a >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B'
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M'
  if (a >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K'
  if (a >= 1) return '$' + n.toFixed(2)
  return '$' + n.toPrecision(2)
}
const pctText = (c) => (c == null ? null : `${c >= 0 ? '▲' : '▼'} ${Math.abs(c).toFixed(1)}%`)

export default function Explore() {
  const { agents, agentsLoading, loadAgents, prices } = useStore()
  const nav = useNavigate()
  const [tab, setTab] = useState('trending')
  const [q, setQ] = useState('')

  const featured = useMemo(() => [...agents].sort((a, b) => capOf(b) - capOf(a)).slice(0, 6), [agents])

  const list = useMemo(() => {
    let l = agents.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.ticker.toLowerCase().includes(q.toLowerCase()))
    if (tab === 'stock') l = l.filter((c) => c.stockPaired)
    else if (tab === 'gainers') l = [...l].filter((c) => c.change24 != null).sort((a, b) => (b.change24 ?? 0) - (a.change24 ?? 0))
    else if (tab === 'new') l = [...l].sort((a, b) => (a.featured ? 1 : 0) - (b.featured ? 1 : 0) || capOf(b) - capOf(a))
    else l = [...l].sort((a, b) => (b.official ? 1 : 0) - (a.official ? 1 : 0) || capOf(b) - capOf(a))
    return l
  }, [agents, tab, q])

  return (
    <div className="space-y-8">
      {featured.length > 0 && <HeroCarousel coins={featured} prices={prices} onTrade={(c) => nav(`/c/${c.id}`)} />}

      <section>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="display text-3xl">Explore coins</h2>
          <button onClick={() => loadAgents(true)} disabled={agentsLoading}
            className="chip cursor-pointer shrink-0" title="Refresh">{agentsLoading ? '…' : '↻'}</button>
        </div>

        {/* filter chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1 mb-4">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`chip cursor-pointer shrink-0 !px-3.5 !py-2 !text-[13px] ${tab === t.key ? 'chip-brand' : ''}`}>
              {t.label}
            </button>
          ))}
          <div className="relative shrink-0 ml-1">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="input !py-2 !px-3 w-36 text-sm" />
          </div>
        </div>

        {agentsLoading && agents.length === 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="card h-52 animate-pulse opacity-40" />)}
          </div>
        ) : list.length === 0 ? (
          <EmptyState q={q} tab={tab} onLaunch={() => nav('/launch')} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {list.map((c) => <GridCard key={c.id} charm={c} price={prices[c.id]} onOpen={() => nav(`/c/${c.id}`)} />)}
          </div>
        )}
      </section>
    </div>
  )
}

/* The big square coin image, or the flat lettered tile when there's no logo. */
function CoinImage({ charm, className = '' }) {
  const [broken, setBroken] = useState(false)
  if (charm.logo && !broken) {
    return <img src={charm.logo} alt="" loading="lazy" onError={() => setBroken(true)}
      className={`object-cover w-full h-full ${className}`} />
  }
  return <div className="w-full h-full grid place-items-center"><CharmAvatar charm={charm} size={92} /></div>
}

/* A tiny creator row: avatar + handle. */
function Creator({ charm }) {
  const handle = (charm.creator || 'anon').replace(/^@/, '')
  const initial = (handle[0] || 'A').toUpperCase()
  return (
    <span className="flex items-center gap-1.5 min-w-0">
      <span className="w-5 h-5 rounded-full grid place-items-center text-[10px] font-semibold shrink-0 bg-[var(--color-paper-2)] text-[var(--color-ink-soft)]">{initial}</span>
      <span className="text-xs text-[var(--color-ink-soft)] truncate">{handle}</span>
    </span>
  )
}

/* Swipeable hero carousel with pagination dots. */
function HeroCarousel({ coins, prices, onTrade }) {
  const ref = useRef(null)
  const [active, setActive] = useState(0)
  const onScroll = () => {
    const el = ref.current
    if (!el) return
    const w = el.clientWidth * 0.9
    setActive(Math.round(el.scrollLeft / w))
  }
  return (
    <div>
      <div ref={ref} onScroll={onScroll}
        className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4 lg:mx-0 lg:px-0">
        {coins.map((c) => {
          const price = prices[c.id] ?? c.price
          const up = (c.change24 ?? 0) >= 0
          return (
            <div key={c.id} className="snap-center shrink-0 w-[90%] lg:w-full">
              <div className="relative rounded-3xl overflow-hidden card-glow h-[300px] cursor-pointer" onClick={() => onTrade(c)}>
                {/* background image */}
                <div className="absolute inset-0"><CoinImage charm={c} className="scale-105 blur-[1px] opacity-60" /></div>
                <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(6,7,13,.35) 0%, rgba(6,7,13,.15) 40%, rgba(6,7,13,.92) 100%)' }} />
                {/* creator */}
                <div className="absolute top-4 left-4 z-10"><Creator charm={c} /></div>
                {/* inset logo */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-32 h-32 rounded-2xl overflow-hidden ring-1 ring-white/15 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)]">
                  <CoinImage charm={c} />
                </div>
                {/* footer */}
                <div className="absolute inset-x-0 bottom-0 p-5 z-10">
                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-serif text-2xl leading-tight truncate">{c.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-xs text-[var(--color-ink-soft)] uppercase truncate">{c.ticker}</span>
                        <Verified size={12} gold={c.official} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono num text-lg font-semibold">{kusd(c.mcap)}</div>
                      {c.change24 != null && <div className={`font-mono num text-xs ${up ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}`}>{pctText(c.change24)}</div>}
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); onTrade(c) }} className="btn btn-holo w-full mt-3 !py-2.5">Trade</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {coins.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {coins.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === active ? 'w-5 bg-[var(--color-ink)]' : 'w-1.5 bg-[var(--color-line-2)]'}`} />
          ))}
        </div>
      )}
    </div>
  )
}

/* feel.cash-style coin card: big image, name/ticker, price/change, creator. */
function GridCard({ charm, price, onOpen }) {
  const up = (charm.change24 ?? 0) >= 0
  return (
    <div onClick={onOpen} className="card card-hover overflow-hidden cursor-pointer flex flex-col">
      <div className="aspect-[4/3] relative">
        <CoinImage charm={charm} />
        {charm.graduated === true && (
          <span className="absolute top-2 right-2 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-black/60 text-white">Grad</span>
        )}
      </div>
      <div className="p-3">
        {/* name + ticker on the left, market cap on the right */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-semibold truncate">{charm.name}</span>
              <Verified size={12} gold={charm.official} />
            </div>
            <div className="text-xs text-[var(--color-ink-faint)] font-mono uppercase truncate">{charm.ticker}</div>
          </div>
          <div className="text-right shrink-0 font-mono num text-sm leading-tight">
            <div className="font-semibold">{kusd(charm.mcap)}</div>
            {charm.change24 != null && (
              <div className={`text-xs ${up ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}`}>{pctText(charm.change24)}</div>
            )}
          </div>
        </div>
        <div className="mt-2 pt-2 border-t hairline"><Creator charm={charm} /></div>
      </div>
    </div>
  )
}

function EmptyState({ q, tab, onLaunch }) {
  if (q) return <div className="card text-center py-16 text-[var(--color-ink-soft)]">No coins match “{q}”.</div>
  if (tab === 'stock') return <div className="card text-center py-16 text-[var(--color-ink-soft)]">No stock-paired coins yet.</div>
  return (
    <div className="card text-center px-6 py-16">
      <div className="mx-auto mb-5 w-14 h-14 rounded-2xl grid place-items-center" style={{ background: 'var(--holo)', boxShadow: '0 0 30px -6px rgba(170,200,245,0.7)' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0a0c15" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
      </div>
      <h3 className="font-serif text-2xl mb-1.5">No coins yet</h3>
      <p className="text-[var(--color-ink-soft)] max-w-sm mx-auto mb-6">Be the first - mint a token that thinks, talks, and trades on AURN.</p>
      <button onClick={onLaunch} className="btn btn-holo !py-3 !px-7 mx-auto">Launch the first coin</button>
    </div>
  )
}
