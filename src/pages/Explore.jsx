import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import CharmAvatar from '../components/CharmAvatar'
import Sparkline from '../components/Sparkline'
import Hero from '../components/Hero'
import Ticker from '../components/Ticker'
import { usd, num, pct } from '../lib/format'
import { useReveal } from '../lib/hooks'
import { Verified, XLogo } from '../components/icons'

const TABS = [
  { key: 'trending', label: 'Trending', fn: (a, b) => b.change24 - a.change24 },
  { key: 'top', label: 'Top', fn: (a, b) => b.mcap - a.mcap },
  { key: 'gainers', label: 'Gainers', fn: (a, b) => b.change24 - a.change24 },
  { key: 'new', label: 'New', fn: (a, b) => (b.isMine ? 1 : 0) - (a.isMine ? 1 : 0) },
]

export default function Explore() {
  const { charms, prices } = useStore()
  const [tab, setTab] = useState('trending')
  const [q, setQ] = useState('')

  const stats = useMemo(() => ({
    count: charms.length,
    mcap: charms.reduce((s, c) => s + c.mcap, 0),
    holders: charms.reduce((s, c) => s + c.holders, 0),
  }), [charms])

  const spotlight = useMemo(() => [...charms].sort((a, b) => b.change24 - a.change24).slice(0, 3), [charms])

  const list = useMemo(() => {
    let l = charms.filter(
      (c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.ticker.toLowerCase().includes(q.toLowerCase()),
    )
    if (tab === 'gainers') l = l.filter((c) => c.change24 >= 0)
    return [...l].sort(TABS.find((t) => t.key === tab).fn)
  }, [charms, tab, q])

  return (
    <div>
      <Hero charms={charms} stats={stats} prices={prices} />
      <Ticker charms={charms} prices={prices} />

      {/* spotlight trio */}
      <Section>
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="display text-3xl">Moving now</h2>
          <span className="eyebrow">Top 3 · 24h</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[var(--color-line)] panel overflow-hidden">
          {spotlight.map((c, i) => <SpotlightCard key={c.id} charm={c} price={prices[c.id]} rank={i} />)}
        </div>
      </Section>

      {/* index */}
      <Section id="index">
        <div className="flex flex-wrap items-baseline justify-between gap-3 mb-5">
          <h2 className="display text-3xl">The index</h2>
          <div className="flex flex-wrap items-center gap-3">
            <div className="seg">
              {TABS.map((t) => <button key={t.key} onClick={() => setTab(t.key)} className={tab === t.key ? 'on' : ''}>{t.label}</button>)}
            </div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="input sm:w-52" />
          </div>
        </div>
        <IndexTable list={list} prices={prices} />
        <IndexCards list={list} prices={prices} />
        {list.length === 0 && <div className="text-center py-16 text-[var(--color-ink-soft)]">No results for "{q}".</div>}
      </Section>
    </div>
  )
}

function Section({ children, id }) {
  const ref = useReveal()
  return <section id={id} ref={ref} className="reveal mb-12 scroll-mt-24">{children}</section>
}

function SpotlightCard({ charm, price, rank }) {
  const nav = useNavigate()
  const up = charm.change24 >= 0
  return (
    <button onClick={() => nav(`/c/${charm.id}`)} className="text-left p-5 hover:bg-[var(--color-paper-2)] transition">
      <div className="flex items-center justify-between mb-4">
        <span className="font-mono num text-2xl text-[var(--color-ink-faint)]">0{rank + 1}</span>
        <span className={`chip ${up ? 'chip-up' : 'chip-down'}`}>{pct(charm.change24)}</span>
      </div>
      <div className="flex items-center gap-3">
        <CharmAvatar charm={charm} size={44} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5"><span className="font-medium truncate">{charm.name}</span><Verified size={13} /></div>
          <div className="text-xs text-[var(--color-ink-faint)]">by {charm.creator}</div>
        </div>
      </div>
      <div className="flex items-end justify-between mt-4">
        <div>
          <div className="font-mono num text-lg">{usd(price ?? charm.price)}</div>
          <div className="eyebrow mt-1">{usd(charm.mcap)} mcap</div>
        </div>
        <Sparkline data={charm.history} up={up} width={84} height={32} />
      </div>
    </button>
  )
}

function IndexTable({ list, prices }) {
  const nav = useNavigate()
  return (
    <div className="hidden md:block card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b hairline">
            {['#', 'Character', 'Price', '24h', 'Market cap', 'Holders', 'Last 24h', ''].map((h) => (
              <th key={h} className="eyebrow px-5 py-3 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.map((c, k) => {
            const up = c.change24 >= 0
            return (
              <tr key={c.id} onClick={() => nav(`/c/${c.id}`)} className="trow cursor-pointer border-b hairline last:border-0">
                <td className="px-5 py-3 font-mono num text-[var(--color-ink-faint)]">{k + 1}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <CharmAvatar charm={c} size={34} />
                    <div>
                      <div className="flex items-center gap-1.5 font-medium">{c.name} <Verified size={12} /></div>
                      <div className="font-mono text-xs text-[var(--color-ink-faint)]">${c.ticker}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 font-mono num">{usd(prices[c.id] ?? c.price)}</td>
                <td className="px-5 py-3"><span className={`font-mono num text-xs px-1.5 py-0.5 rounded ${up ? 'chip-up' : 'chip-down'}`}>{pct(c.change24)}</span></td>
                <td className="px-5 py-3 font-mono num">{usd(c.mcap)}</td>
                <td className="px-5 py-3 font-mono num text-[var(--color-ink-soft)]">{num(c.holders)}</td>
                <td className="px-5 py-3"><Sparkline data={c.history} up={up} width={100} height={28} /></td>
                <td className="px-5 py-3 text-right"><button onClick={(e) => { e.stopPropagation(); nav(`/c/${c.id}`) }} className="btn btn-secondary !py-1.5 !px-3.5 text-xs">Trade</button></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function IndexCards({ list, prices }) {
  const nav = useNavigate()
  return (
    <div className="md:hidden space-y-2.5">
      {list.map((c) => {
        const up = c.change24 >= 0
        return (
          <div key={c.id} onClick={() => nav(`/c/${c.id}`)} className="card card-hover p-3.5 flex items-center gap-3 cursor-pointer">
            <CharmAvatar charm={c} size={44} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 font-medium">{c.name} <Verified size={12} /></div>
              <div className="font-mono text-xs text-[var(--color-ink-faint)]">${c.ticker}</div>
            </div>
            <Sparkline data={c.history} up={up} width={54} height={24} className="hidden xs:block" />
            <div className="text-right">
              <div className="font-mono num text-sm font-medium">{usd(prices[c.id] ?? c.price)}</div>
              <div className={`font-mono num text-xs ${up ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}`}>{pct(c.change24)}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
