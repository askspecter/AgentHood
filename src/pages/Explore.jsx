import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import CharmAvatar from '../components/CharmAvatar'
import Sparkline from '../components/Sparkline'
import { usd, num, pct } from '../lib/format'
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

  const featured = useMemo(() => [...charms].sort((a, b) => b.mcap - a.mcap)[0], [charms])
  const stats = useMemo(() => {
    const mcap = charms.reduce((s, c) => s + c.mcap, 0)
    const holders = charms.reduce((s, c) => s + c.holders, 0)
    return { count: charms.length, mcap, holders }
  }, [charms])

  const list = useMemo(() => {
    let l = charms.filter(
      (c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.ticker.toLowerCase().includes(q.toLowerCase()),
    )
    if (tab === 'gainers') l = l.filter((c) => c.change24 >= 0)
    return [...l].sort(TABS.find((t) => t.key === tab).fn)
  }, [charms, tab, q])

  return (
    <div>
      {/* hero */}
      <section className="fade-up mb-4">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="chip chip-brand">New</span>
          <span className="text-sm text-[var(--color-ink-soft)]">A market for characters worth owning.</span>
        </div>
        <h1 className="font-serif text-5xl lg:text-6xl leading-[1.02] max-w-2xl tracking-[-0.01em]">
          Discover characters before the timeline does.
        </h1>
        <p className="mt-4 text-lg text-[var(--color-ink-soft)] max-w-xl">
          Every character has a personality, a story, and a coin. Trade the ones you believe in, or mint your own.
        </p>
      </section>

      {/* featured + stats */}
      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4 mb-10">
        <Featured charm={featured} price={prices[featured?.id]} />
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
          <StatCard label="Characters live" value={num(stats.count) + '+'} />
          <StatCard label="Total market cap" value={usd(stats.mcap)} />
          <StatCard label="Holders" value={num(stats.holders)} className="col-span-2 lg:col-span-1" />
        </div>
      </div>

      {/* index */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="seg">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={tab === t.key ? 'on' : ''}>{t.label}</button>
          ))}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search characters…" className="input sm:w-64" />
      </div>

      <IndexTable list={list} prices={prices} />
      <IndexCards list={list} prices={prices} />
      {list.length === 0 && <div className="text-center py-16 text-[var(--color-ink-soft)]">No results for "{q}".</div>}
    </div>
  )
}

function Featured({ charm, price }) {
  const nav = useNavigate()
  if (!charm) return null
  const up = charm.change24 >= 0
  return (
    <div className="card card-hover overflow-hidden cursor-pointer relative" onClick={() => nav(`/c/${charm.id}`)}>
      <div className="absolute inset-x-0 top-0 h-28"
        style={{ background: `linear-gradient(180deg, hsl(${charm.hue} 45% 94%), transparent)` }} />
      <div className="relative p-6">
        <div className="flex items-center justify-between mb-6">
          <span className="chip">Featured</span>
          <span className={`chip ${up ? 'chip-up' : 'chip-down'}`}>{pct(charm.change24)} 24h</span>
        </div>
        <div className="flex items-center gap-4">
          <CharmAvatar charm={charm} size={64} ring />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-serif text-2xl">{charm.name}</span>
              <Verified size={16} />
            </div>
            <div className="flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)] mt-0.5">
              <span className="font-mono">${charm.ticker}</span>
              <span className="opacity-40">·</span>
              <XLogo size={10} /><span>{charm.creator}</span>
            </div>
          </div>
        </div>
        <p className="mt-4 text-[var(--color-ink-soft)]">{charm.tagline}</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <div>
            <div className="eyebrow mb-0.5">Price</div>
            <div className="font-mono num text-2xl font-semibold">{usd(price ?? charm.price)}</div>
          </div>
          <Sparkline data={charm.history} up={up} width={120} height={44} className="hidden sm:block shrink-0" />
          <button onClick={(e) => { e.stopPropagation(); nav(`/c/${charm.id}`) }} className="btn btn-primary shrink-0">Trade</button>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, className = '' }) {
  return (
    <div className={`card p-5 ${className}`}>
      <div className="eyebrow mb-2">{label}</div>
      <div className="font-mono num text-2xl font-semibold">{value}</div>
    </div>
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
                <td className="px-5 py-3">
                  <span className={`font-mono num text-xs px-1.5 py-0.5 rounded ${up ? 'chip-up' : 'chip-down'}`}>{pct(c.change24)}</span>
                </td>
                <td className="px-5 py-3 font-mono num">{usd(c.mcap)}</td>
                <td className="px-5 py-3 font-mono num text-[var(--color-ink-soft)]">{num(c.holders)}</td>
                <td className="px-5 py-3"><Sparkline data={c.history} up={up} width={100} height={28} /></td>
                <td className="px-5 py-3 text-right">
                  <button onClick={(e) => { e.stopPropagation(); nav(`/c/${c.id}`) }} className="btn btn-secondary !py-1.5 !px-3.5 text-xs">Trade</button>
                </td>
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
