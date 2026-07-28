import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import CharmAvatar, { toneFor } from '../components/CharmAvatar'
import Ticker from '../components/Ticker'
import CharmCarousel from '../components/CharmCarousel'
import { usd, num, pct } from '../lib/format'
import { useReveal } from '../lib/hooks'
import { Verified, Mentions, ArrowStat } from '../components/icons'

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

  const cast = useMemo(() => [...charms].sort((a, b) => b.change24 - a.change24).slice(0, 6), [charms])

  const list = useMemo(() => {
    let l = charms.filter(
      (c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.ticker.toLowerCase().includes(q.toLowerCase()),
    )
    if (tab === 'gainers') l = l.filter((c) => c.change24 >= 0)
    return [...l].sort(TABS.find((t) => t.key === tab).fn)
  }, [charms, tab, q])

  return (
    <div>
      {/* cast — a titleless swipeable feature strip */}
      <div className="fade-up mb-9 pt-1">
        <CharmCarousel charms={cast} prices={prices} />
      </div>

      <Ticker charms={charms} prices={prices} />

      {/* explore — grid of boxes */}
      <Section id="index">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h2 className="display text-3xl">Explore</h2>
          <div className="relative w-full sm:w-56">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search characters…" className="input" />
          </div>
        </div>

        <div className="seg no-scrollbar mb-5 flex overflow-x-auto max-w-full">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`shrink-0 ${tab === t.key ? 'on' : ''}`}>{t.label}</button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {list.map((c) => <GridCard key={c.id} charm={c} />)}
        </div>
        {list.length === 0 && <div className="text-center py-16 text-[var(--color-ink-soft)]">No results for "{q}".</div>}
      </Section>
    </div>
  )
}

function Section({ children, id }) {
  const ref = useReveal()
  return <section id={id} ref={ref} className="reveal mb-12 scroll-mt-24">{children}</section>
}

function GridCard({ charm }) {
  const nav = useNavigate()
  const up = charm.change24 >= 0
  const [c1] = toneFor(charm)
  const open = () => nav(`/c/${charm.id}`)
  return (
    <div onClick={open}
      className="card card-hover p-4 flex flex-col items-center text-center cursor-pointer">
      <div className="relative mb-3 mt-1 grid place-items-center">
        <span className="absolute rounded-full blur-2xl opacity-45 pointer-events-none"
          style={{ width: 76, height: 76, background: c1 }} />
        <div className="relative"><CharmAvatar charm={charm} size={76} ring /></div>
      </div>

      <div className="flex items-center gap-1.5 min-w-0 max-w-full">
        <span className="font-semibold truncate">{charm.name}</span>
        <Verified size={13} />
      </div>

      <div className="flex items-center justify-center gap-3 mt-1.5 font-mono num text-xs">
        <span className="inline-flex items-center gap-1 text-[var(--color-ink-soft)]">
          {usd(charm.mcap)}<ArrowStat up={up} size={14} />
        </span>
        <span className="inline-flex items-center gap-1 text-[var(--color-ink-faint)]">
          {num(charm.holders)}<Mentions size={13} />
        </span>
      </div>

      <button onClick={(e) => { e.stopPropagation(); open() }}
        className="btn btn-holo static w-full mt-4 !py-2 text-sm">Trade</button>
    </div>
  )
}
