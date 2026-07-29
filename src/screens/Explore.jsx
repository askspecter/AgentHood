import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import CharmAvatar from '../components/CharmAvatar'
import Ticker from '../components/Ticker'
import CharmCarousel from '../components/CharmCarousel'
import { usd, num, pct } from '../lib/format'
import { Verified, ArrowStat, Mentions } from '../components/icons'

/**
 * Discover — the charms.ai front page, powered by real pons coins.
 *
 * Every "character" here is an agent: a real token launched on pons, dressed in
 * the original look (hero, swipeable rail, ticker, grid). Tapping one opens its
 * agent page where you can chat with it and trade it.
 */

const TABS = [
  { key: 'top', label: 'Top' },
  { key: 'new', label: 'New' },
  { key: 'graduated', label: 'Graduated' },
]

// Rank by the real on-chain market cap (in WETH), which — unlike the USD `mcap`
// — is present even when the ETH/USD rate is missing, so the order never
// collapses to "newest coin with any non-zero number first".
const capOf = (c) => (Number.isFinite(c.marketCapWeth) ? c.marketCapWeth : 0)
// Top: established (featured) coins first, then by cap — so PONS and the other
// known coins never get demoted below a fresh launch that read a stray cap.
const byTop = (a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || capOf(b) - capOf(a)
// New: freshly-discovered (non-featured) launches first, then by cap.
const byNew = (a, b) => (a.featured ? 1 : 0) - (b.featured ? 1 : 0) || capOf(b) - capOf(a)

export default function Explore() {
  const { agents, agentsLoading, loadAgents, prices } = useStore()
  const [tab, setTab] = useState('top')
  const [q, setQ] = useState('')

  const cast = useMemo(() => [...agents].sort(byTop).slice(0, 6), [agents])

  const list = useMemo(() => {
    let l = agents.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.ticker.toLowerCase().includes(q.toLowerCase()))
    if (tab === 'graduated') l = l.filter((c) => c.graduated === true)
    if (tab === 'top') l = [...l].sort(byTop)
    else if (tab === 'new') l = [...l].sort(byNew)
    return l
  }, [agents, tab, q])

  return (
    <div>
      {agents.length > 0 && (
        <div className="fade-up mb-9 pt-2">
          <CharmCarousel charms={cast} prices={prices} />
        </div>
      )}

      {agents.length > 0 && <Ticker charms={agents} prices={prices} />}

      <Section id="index">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="display text-3xl">Discover</h2>
            <p className="text-[var(--color-ink-soft)] text-sm mt-1">Live agents · coins on pons · Robinhood Chain</p>
          </div>
          <div className="relative w-full sm:w-56">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search agents…" className="input" />
          </div>
        </div>

        <div className="seg no-scrollbar mb-5 flex overflow-x-auto max-w-full">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`shrink-0 ${tab === t.key ? 'on' : ''}`}>{t.label}</button>
          ))}
          <button onClick={() => loadAgents(true)} disabled={agentsLoading} className="shrink-0 ml-auto">{agentsLoading ? '…' : '↻'}</button>
        </div>

        {agentsLoading && agents.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="card p-4 h-48 animate-pulse opacity-40" />)}
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-16 text-[var(--color-ink-soft)]">
            {q ? `No agents match "${q}".` : 'No coins found yet. Launch the first one.'}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {list.map((c) => <GridCard key={c.id} charm={c} price={prices[c.id]} />)}
          </div>
        )}
      </Section>
    </div>
  )
}

function Section({ children, id }) {
  return <section id={id} className="mb-12 scroll-mt-24">{children}</section>
}

function GridCard({ charm, price }) {
  const nav = useNavigate()
  const open = () => nav(`/c/${charm.id}`)
  const up = (charm.change24 ?? 0) >= 0
  return (
    <div onClick={open} className="card card-hover p-4 flex flex-col items-center text-center cursor-pointer">
      <div className="relative mb-3 mt-1 grid place-items-center">
        <div className="relative"><CharmAvatar charm={charm} size={76} ring /></div>
        {charm.graduated === true && (
          <span className="absolute -top-1 -right-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-black/60 text-white">Grad</span>
        )}
      </div>

      <div className="flex items-center gap-1.5 min-w-0 max-w-full">
        <span className="font-semibold truncate">{charm.name}</span>
        <Verified size={13} />
      </div>
      <div className="text-xs text-[var(--color-ink-faint)] font-mono">${charm.ticker}</div>

      <div className="flex items-center justify-center gap-2 mt-1.5 font-mono num text-xs">
        <span className="text-[var(--color-ink-soft)]">{charm.mcap ? usd(charm.mcap) : '—'}</span>
        {charm.change24 != null && (
          <span className={charm.change24 >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}>{pct(charm.change24)}</span>
        )}
        {charm.holders != null && (
          <span className="inline-flex items-center gap-1 text-[var(--color-ink-faint)]">
            <Mentions size={12} />{num(charm.holders)}
          </span>
        )}
      </div>

      <button onClick={(e) => { e.stopPropagation(); open() }}
        className="btn btn-holo static w-full mt-4 !py-2 text-sm">Open</button>
    </div>
  )
}
