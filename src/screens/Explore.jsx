import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import CharmAvatar from '../components/CharmAvatar'
import { usd, num, pct } from '../lib/format'
import { Verified, Mentions } from '../components/icons'

/**
 * Home — AURN's own front. Not the charms-style spotlight-carousel + ticker +
 * avatar grid, but an editorial hero over a glacial ring, and below it a market
 * ledger: coins as ranked rows, the way a terminal lists them. The front is
 * quiet by default — it fills only with coins launched through AURN.
 */

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'graduated', label: 'Graduated' },
]

const capOf = (c) => (Number.isFinite(c.mcap) && c.mcap > 0 ? c.mcap : (Number.isFinite(c.marketCapWeth) ? c.marketCapWeth : 0))
const byCap = (a, b) => (b.official ? 1 : 0) - (a.official ? 1 : 0) || capOf(b) - capOf(a)
const byNew = (a, b) => (a.featured ? 1 : 0) - (b.featured ? 1 : 0) || capOf(b) - capOf(a)

export default function Explore() {
  const { agents, agentsLoading, loadAgents, prices } = useStore()
  const nav = useNavigate()
  const [tab, setTab] = useState('all')
  const [q, setQ] = useState('')

  const list = useMemo(() => {
    let l = agents.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.ticker.toLowerCase().includes(q.toLowerCase()))
    if (tab === 'graduated') l = l.filter((c) => c.graduated === true)
    l = [...l].sort(tab === 'new' ? byNew : byCap)
    return l
  }, [agents, tab, q])

  return (
    <div className="space-y-14">
      {/* ===== hero ===== */}
      <section className="relative overflow-hidden rounded-[28px] border hairline"
        style={{ background: 'linear-gradient(160deg, rgba(20,26,44,0.55), rgba(8,10,18,0.4))' }}>
        <Ring />
        <div className="relative z-10 px-7 sm:px-12 py-14 sm:py-20 max-w-2xl">
          <div className="eyebrow mb-5">Robinhood Chain · non-custodial</div>
          <h1 className="display text-[2.6rem] sm:text-6xl leading-[0.95]">
            Coins with a<br /><span className="holo-text">soul</span>, on-chain.
          </h1>
          <p className="mt-6 text-[var(--color-ink-soft)] text-base sm:text-lg max-w-lg leading-relaxed">
            Launch a token that lives as an AI agent, trade it from your own wallet,
            and watch it graduate.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button onClick={() => nav('/launch')} className="btn btn-holo !py-3 !px-6">Launch a coin</button>
            <button onClick={() => nav('/about')} className="btn btn-ghost !py-3 !px-6">How it works</button>
          </div>
        </div>
      </section>

      {/* ===== market ledger ===== */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="display text-3xl">Market</h2>
            <p className="text-[var(--color-ink-soft)] text-sm mt-1">
              {agents.length > 0 ? `${agents.length} coin${agents.length === 1 ? '' : 's'} live on AURN` : 'Every coin launched through AURN, ranked live'}
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or ticker…" className="input" />
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="seg no-scrollbar flex overflow-x-auto">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)} className={`shrink-0 ${tab === t.key ? 'on' : ''}`}>{t.label}</button>
            ))}
          </div>
          <button onClick={() => loadAgents(true)} disabled={agentsLoading}
            className="ml-auto chip cursor-pointer" title="Refresh">{agentsLoading ? '…' : '↻ Refresh'}</button>
        </div>

        {agentsLoading && agents.length === 0 ? (
          <div className="card divide-y divide-[var(--color-line)]">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 animate-pulse opacity-40" />)}
          </div>
        ) : list.length === 0 ? (
          <EmptyState q={q} onLaunch={() => nav('/launch')} />
        ) : (
          <div className="card overflow-hidden">
            {/* column header — desktop only */}
            <div className="hidden md:grid grid-cols-[2.5rem_1fr_9rem_6rem_9rem_6rem_5rem] items-center gap-3 px-5 py-3 eyebrow border-b hairline">
              <span>#</span><span>Coin</span><span className="text-right">Price</span>
              <span className="text-right">24h</span><span className="text-right">Market cap</span>
              <span className="text-right">Holders</span><span></span>
            </div>
            {list.map((c, i) => <Row key={c.id} charm={c} price={prices[c.id]} rank={i + 1} onOpen={() => nav(`/c/${c.id}`)} />)}
          </div>
        )}
      </section>
    </div>
  )
}

/* The glacial ring motif from the cover art — pure CSS, sits in the hero. */
function Ring() {
  return (
    <div className="pointer-events-none absolute -right-16 -top-10 sm:right-6 sm:top-1/2 sm:-translate-y-1/2 opacity-70">
      <div className="relative w-[300px] h-[300px] sm:w-[380px] sm:h-[380px] floaty">
        <div className="absolute inset-0 rounded-full"
          style={{ background: 'radial-gradient(circle at 50% 42%, transparent 52%, rgba(190,210,250,0.55) 58%, transparent 66%)', filter: 'blur(2px)' }} />
        <div className="absolute inset-0 rounded-full"
          style={{ boxShadow: '0 0 120px 10px rgba(160,192,240,0.35)' }} />
        <div className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 w-[46%] h-[58%] rounded-[50%]"
          style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(220,232,255,0.14), transparent 70%)', border: '1px solid rgba(200,220,255,0.35)' }} />
      </div>
    </div>
  )
}

function EmptyState({ q, onLaunch }) {
  if (q) return <div className="card text-center py-16 text-[var(--color-ink-soft)]">No coins match “{q}”.</div>
  return (
    <div className="card text-center px-6 py-16">
      <div className="mx-auto mb-5 w-14 h-14 rounded-2xl grid place-items-center" style={{ background: 'var(--holo)', boxShadow: '0 0 30px -6px rgba(170,200,245,0.7)' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0a0c15" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
      </div>
      <h3 className="font-serif text-2xl mb-1.5">The market is empty</h3>
      <p className="text-[var(--color-ink-soft)] max-w-sm mx-auto mb-6">No coins have launched on AURN yet. Be the first — mint a token that thinks, talks, and trades.</p>
      <button onClick={onLaunch} className="btn btn-holo !py-3 !px-7 mx-auto">Launch the first coin</button>
    </div>
  )
}

function Row({ charm, price, rank, onOpen }) {
  const up = (charm.change24 ?? 0) >= 0
  return (
    <div onClick={onOpen}
      className="trow grid grid-cols-[1.5rem_1fr_auto] md:grid-cols-[2.5rem_1fr_9rem_6rem_9rem_6rem_5rem] items-center gap-3 px-4 md:px-5 py-3.5 cursor-pointer border-b hairline last:border-0">
      <span className="font-mono num text-sm text-[var(--color-ink-faint)]">{rank}</span>

      <div className="flex items-center gap-3 min-w-0">
        <CharmAvatar charm={charm} size={40} ring />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-semibold truncate">{charm.name}</span>
            <Verified size={12} gold={charm.official} />
            {charm.graduated === true && <span className="chip chip-up !py-0 !text-[10px]">Grad</span>}
          </div>
          <div className="text-xs text-[var(--color-ink-faint)] font-mono">${charm.ticker}</div>
        </div>
      </div>

      {/* mobile: compact price + change stacked at the right */}
      <div className="md:hidden text-right">
        <div className="font-mono num text-sm">{price ? usd(price) : '—'}</div>
        {charm.change24 != null && (
          <div className={`font-mono num text-xs ${up ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}`}>{pct(charm.change24)}</div>
        )}
      </div>

      {/* desktop columns */}
      <div className="hidden md:block text-right font-mono num text-sm">{price ? usd(price) : '—'}</div>
      <div className={`hidden md:block text-right font-mono num text-sm ${charm.change24 == null ? 'text-[var(--color-ink-faint)]' : up ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}`}>
        {charm.change24 != null ? pct(charm.change24) : '—'}
      </div>
      <div className="hidden md:block text-right font-mono num text-sm text-[var(--color-ink-soft)]">{charm.mcap ? usd(charm.mcap) : '—'}</div>
      <div className="hidden md:flex items-center justify-end gap-1 font-mono num text-sm text-[var(--color-ink-faint)]">
        {charm.holders != null ? (<><Mentions size={12} />{num(charm.holders)}</>) : '—'}
      </div>
      <div className="hidden md:flex justify-end">
        <button onClick={(e) => { e.stopPropagation(); onOpen() }} className="btn btn-secondary !py-1.5 !px-3 text-xs">Open</button>
      </div>
    </div>
  )
}
