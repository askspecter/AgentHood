import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import CharmAvatar from '../components/CharmAvatar'
import Hero from '../components/Hero'
import Ticker from '../components/Ticker'
import CharmCarousel from '../components/CharmCarousel'
import { usd } from '../lib/format'
import { Verified, ArrowStat } from '../components/icons'

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

const friendly = (m) =>
  /SSL|EPROTO|handshake|allowlist|ECONN|ENOTFOUND|timeout|fetch|network|unreachable|502|server response/i.test(String(m || ''))
    ? "Couldn't reach Robinhood Chain right now — the feed is unavailable. Tap refresh."
    : String(m || '')

export default function Explore() {
  const { agents, agentsLoading, agentsError, loadAgents, prices } = useStore()
  const [tab, setTab] = useState('top')
  const [q, setQ] = useState('')

  const cast = useMemo(() => [...agents].sort((a, b) => b.mcap - a.mcap).slice(0, 6), [agents])

  const list = useMemo(() => {
    let l = agents.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.ticker.toLowerCase().includes(q.toLowerCase()))
    if (tab === 'graduated') l = l.filter((c) => c.graduated === true)
    if (tab === 'top') l = [...l].sort((a, b) => b.mcap - a.mcap)
    // 'new' keeps the feed's newest-first order
    return l
  }, [agents, tab, q])

  return (
    <div>
      <Hero stats={{ count: agents.length }} />

      {agents.length > 0 && (
        <div className="fade-up mb-9 pt-1">
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
          <button onClick={loadAgents} disabled={agentsLoading} className="shrink-0 ml-auto">{agentsLoading ? '…' : '↻'}</button>
        </div>

        {agentsError && <div className="chip chip-down w-full mb-4">{friendly(agentsError)}</div>}

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
  return (
    <div onClick={open} className="card card-hover p-4 flex flex-col items-center text-center cursor-pointer">
      <div className="relative mb-3 mt-1 grid place-items-center">
        <div className="relative"><CharmAvatar charm={charm} size={76} ring square={!!charm.logo} /></div>
        {charm.graduated === true && (
          <span className="absolute -top-1 -right-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-black/60 text-white">Grad</span>
        )}
      </div>

      <div className="flex items-center gap-1.5 min-w-0 max-w-full">
        <span className="font-semibold truncate">{charm.name}</span>
        <Verified size={13} />
      </div>
      <div className="text-xs text-[var(--color-ink-faint)] font-mono">${charm.ticker}</div>

      <div className="flex items-center justify-center gap-1 mt-1.5 font-mono num text-xs text-[var(--color-ink-soft)]">
        {charm.mcap ? usd(charm.mcap) : '—'}<span className="text-[10px] text-[var(--color-ink-faint)] ml-0.5">MC</span>
      </div>

      <button onClick={(e) => { e.stopPropagation(); open() }}
        className="btn btn-holo static w-full mt-4 !py-2 text-sm">Open</button>
    </div>
  )
}
