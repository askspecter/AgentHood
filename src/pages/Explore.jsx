import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import CharmAvatar from '../components/CharmAvatar'
import Sparkline from '../components/Sparkline'
import { usd, num, pct } from '../lib/format'
import { Verified, XLogo, Chevron } from '../components/icons'

const TABS = [
  { key: 'trending', label: 'Trending', fn: (a, b) => b.change24 - a.change24 },
  { key: 'top', label: 'Top', fn: (a, b) => b.mcap - a.mcap },
  { key: 'icons', label: 'Icons', fn: (a, b) => b.followers - a.followers },
  { key: 'new', label: 'New', fn: (a, b) => (b.isMine ? 1 : 0) - (a.isMine ? 1 : 0) },
]

export default function Explore() {
  const { charms, prices } = useStore()
  const [tab, setTab] = useState('trending')
  const [q, setQ] = useState('')

  const featured = useMemo(() => [...charms].sort((a, b) => b.mcap - a.mcap).slice(0, 5), [charms])

  const list = useMemo(() => {
    let l = charms.filter(
      (c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.ticker.toLowerCase().includes(q.toLowerCase()),
    )
    return [...l].sort(TABS.find((t) => t.key === tab).fn)
  }, [charms, tab, q])

  return (
    <div className="max-w-6xl mx-auto">
      <Stage featured={featured} />
      <Ticker charms={charms} prices={prices} />

      {/* index header */}
      <div className="mt-12 mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow mb-1">The index</div>
          <h2 className="font-serif text-4xl lg:text-5xl">Every character, live</h2>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search characters and tickers"
          className="w-full sm:w-80 rounded-full px-5 py-2.5 text-sm outline-none bg-white/4 border border-white/12 focus:border-[rgba(217,165,82,.5)]"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6 -mx-1 px-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition border ${
              tab === t.key
                ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent-hi)] border-[rgba(217,165,82,.4)]'
                : 'bg-white/4 text-[var(--color-ink-soft)] border-white/10 hover:bg-white/8'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* desktop table */}
      <IndexTable list={list} prices={prices} />
      {/* mobile cards */}
      <IndexCards list={list} prices={prices} />

      {list.length === 0 && (
        <div className="text-center py-16 text-[var(--color-ink-soft)]">Nothing matches "{q}".</div>
      )}
    </div>
  )
}

/* ============ cinematic stage ============ */
function Stage({ featured }) {
  const nav = useNavigate()
  const { prices } = useStore()
  const [i, setI] = useState(0)
  const c = featured[i]

  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % featured.length), 6000)
    return () => clearInterval(t)
  }, [featured.length])

  if (!c) return null
  const up = c.change24 >= 0
  const price = prices[c.id] ?? c.price

  return (
    <section
      key={c.id}
      className="relative overflow-hidden border border-white/10"
      style={{
        borderRadius: '2rem',
        background: `
          radial-gradient(110% 120% at 85% 10%, hsl(${c.hue} 60% 26% / .8), transparent 55%),
          radial-gradient(90% 100% at 10% 100%, hsl(${(c.hue + 60) % 360} 55% 18% / .7), transparent 60%),
          linear-gradient(180deg, #0a0c14 0%, #05060a 100%)`,
        boxShadow: `0 40px 120px -50px hsl(${c.hue} 70% 35% / .8)`,
      }}
    >
      {/* giant ghost name */}
      <div className="ghost-title absolute -bottom-4 left-0 right-0 text-center pointer-events-none"
        style={{ fontSize: 'clamp(6rem, 22vw, 20rem)' }}>
        {c.name.split(' ')[0].toUpperCase()}
      </div>
      {/* light streak */}
      <div className="pointer-events-none absolute left-0 right-0 top-16 h-px opacity-70"
        style={{ background: `linear-gradient(90deg, transparent, hsl(${c.hue} 80% 70% / .5), transparent)` }} />

      <div className="relative z-10 grid lg:grid-cols-[1.2fr_1fr] gap-6 items-center px-6 sm:px-10 lg:px-14 py-12 lg:py-16 min-h-[420px] lg:min-h-[480px]">
        {/* copy */}
        <div className="order-2 lg:order-1 text-center lg:text-left">
          <div className="eyebrow fade-up mb-3">Now trending</div>
          <h1 className="font-serif leading-[.95] fade-up fade-up-1"
            style={{ fontSize: 'clamp(2.8rem, 6vw, 4.8rem)' }}>
            {c.name}
          </h1>
          <div className="fade-up fade-up-1 mt-3 flex items-center justify-center lg:justify-start gap-2 text-[var(--color-ink-soft)] text-sm">
            <Verified size={15} />
            <span className="font-mono">${c.ticker}</span>
            <span className="opacity-40">/</span>
            <XLogo size={10} />
            <span>{c.creator}</span>
          </div>
          <p className="fade-up fade-up-2 font-serif italic text-xl lg:text-2xl text-white/85 mt-4 max-w-md mx-auto lg:mx-0">
            {c.tagline.replace(/\.$/, '')}
          </p>

          <div className="fade-up fade-up-2 mt-6 flex items-center justify-center lg:justify-start gap-6 font-mono">
            <Metric label="Price" value={usd(price)} />
            <Metric label="24h" value={pct(c.change24)} tone={up ? 'up' : 'down'} />
            <Metric label="MCAP" value={usd(c.mcap)} />
            <Metric label="Holders" value={num(c.holders)} />
          </div>

          <div className="fade-up fade-up-3 mt-8 flex items-center justify-center lg:justify-start gap-3">
            <button onClick={() => nav(`/c/${c.id}`)} className="btn btn-primary">Trade ${c.ticker}</button>
            <button onClick={() => nav(`/chat/${c.id}`)} className="btn btn-ghost">Chat</button>
          </div>
        </div>

        {/* orb */}
        <div className="order-1 lg:order-2 grid place-items-center">
          <div className="relative grid place-items-center">
            <div className="halo absolute rounded-full border border-white/10"
              style={{ width: 'clamp(220px, 26vw, 340px)', height: 'clamp(220px, 26vw, 340px)', borderStyle: 'dashed' }} />
            <div className="absolute rounded-full border border-[rgba(217,165,82,.25)]"
              style={{ width: 'clamp(260px, 30vw, 400px)', height: 'clamp(260px, 30vw, 400px)' }} />
            <div className="drift">
              <CharmAvatar charm={c} size={200} ring />
            </div>
          </div>
        </div>
      </div>

      {/* controls */}
      <div className="relative z-10 flex items-center justify-between px-6 sm:px-10 lg:px-14 pb-6">
        <div className="flex gap-1.5">
          {featured.map((_, k) => (
            <button key={k} onClick={() => setI(k)} className="h-1 rounded-full transition-all"
              style={{ width: k === i ? 26 : 8, background: k === i ? 'var(--color-accent)' : 'rgba(255,255,255,.22)' }} />
          ))}
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <button onClick={() => setI((i - 1 + featured.length) % featured.length)}
            className="w-9 h-9 grid place-items-center rounded-full bg-white/5 border border-white/15 rotate-180"><Chevron size={16} /></button>
          <button onClick={() => setI((i + 1) % featured.length)}
            className="w-9 h-9 grid place-items-center rounded-full bg-white/5 border border-white/15"><Chevron size={16} /></button>
        </div>
      </div>
    </section>
  )
}

function Metric({ label, value, tone }) {
  const color = tone === 'up' ? 'var(--color-up)' : tone === 'down' ? 'var(--color-down)' : 'var(--color-ink)'
  return (
    <div className="text-left">
      <div className="eyebrow !tracking-[.2em]">{label}</div>
      <div className="font-semibold mt-0.5" style={{ color }}>{value}</div>
    </div>
  )
}

/* ============ ticker marquee ============ */
function Ticker({ charms, prices }) {
  const items = [...charms, ...charms]
  return (
    <div className="mt-6 border-y hairline py-3 overflow-hidden -mx-4 lg:-mx-10 px-4">
      <div className="marquee">
        {items.map((c, k) => {
          const up = c.change24 >= 0
          return (
            <span key={k} className="flex items-center gap-2.5 text-sm shrink-0">
              <span className="font-mono font-bold text-[var(--color-accent-hi)]">${c.ticker}</span>
              <span className="font-mono">{usd(prices[c.id] ?? c.price)}</span>
              <span className={`font-mono text-xs ${up ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}`}>{pct(c.change24)}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

/* ============ desktop table ============ */
function IndexTable({ list, prices }) {
  const nav = useNavigate()
  return (
    <div className="hidden md:block card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b hairline">
            {['#', 'Character', 'Price', '24h', 'MCAP', 'Holders', 'Last 24h', ''].map((h) => (
              <th key={h} className="eyebrow !text-[10px] px-5 py-3.5 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.map((c, k) => {
            const up = c.change24 >= 0
            return (
              <tr key={c.id} onClick={() => nav(`/c/${c.id}`)} className="trow cursor-pointer border-b hairline last:border-0">
                <td className="px-5 py-3 font-mono text-[var(--color-ink-soft)]">{String(k + 1).padStart(2, '0')}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <CharmAvatar charm={c} size={36} />
                    <div>
                      <div className="flex items-center gap-1.5 font-semibold">{c.name} <Verified size={13} /></div>
                      <div className="font-mono text-xs text-[var(--color-ink-soft)]">${c.ticker}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 font-mono">{usd(prices[c.id] ?? c.price)}</td>
                <td className={`px-5 py-3 font-mono ${up ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}`}>{pct(c.change24)}</td>
                <td className="px-5 py-3 font-mono">{usd(c.mcap)}</td>
                <td className="px-5 py-3 font-mono">{num(c.holders)}</td>
                <td className="px-5 py-3"><Sparkline data={c.history} up={up} width={110} height={30} /></td>
                <td className="px-5 py-3 text-right">
                  <button onClick={(e) => { e.stopPropagation(); nav(`/c/${c.id}`) }} className="btn btn-accent !py-1.5 !px-4 text-xs">Trade</button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ============ mobile cards ============ */
function IndexCards({ list, prices }) {
  const nav = useNavigate()
  return (
    <div className="md:hidden grid grid-cols-2 gap-3">
      {list.map((c) => {
        const up = c.change24 >= 0
        return (
          <div key={c.id} onClick={() => nav(`/c/${c.id}`)}
            className="card p-4 flex flex-col items-center text-center cursor-pointer"
            style={{ boxShadow: `0 24px 60px -34px hsl(${c.hue} 70% 40% / .5)` }}>
            <CharmAvatar charm={c} size={72} />
            <div className="mt-3 flex items-center gap-1.5">
              <span className="font-serif text-lg leading-none">{c.name}</span>
              <Verified size={14} />
            </div>
            <div className="mt-1.5 font-mono text-xs text-[var(--color-ink-soft)]">
              {usd(prices[c.id] ?? c.price)}
              <span className={`ml-1.5 ${up ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}`}>{pct(c.change24)}</span>
            </div>
            <button onClick={(e) => { e.stopPropagation(); nav(`/c/${c.id}`) }} className="btn btn-ghost w-full mt-3 !py-2 text-sm">Trade</button>
          </div>
        )
      })}
    </div>
  )
}
