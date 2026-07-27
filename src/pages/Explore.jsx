import { useMemo, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import CharmCard from '../components/CharmCard'
import FeaturedCard from '../components/FeaturedCard'

const TABS = [
  { key: 'trending', label: 'Trending', icon: '📈', fn: (a, b) => b.change24 - a.change24 },
  { key: 'top', label: 'Top', icon: '👑', fn: (a, b) => b.mcap - a.mcap },
  { key: 'icons', label: 'Icons', icon: '🔵', fn: (a, b) => b.followers - a.followers },
  { key: 'new', label: 'New', icon: '✦', fn: (a, b) => (b.isMine ? 1 : 0) - (a.isMine ? 1 : 0) },
  { key: 'external', label: 'External', icon: '🌐', fn: (a, b) => a.name.localeCompare(b.name) },
]

export default function Explore() {
  const { charms } = useStore()
  const [tab, setTab] = useState('trending')
  const [q, setQ] = useState('')
  const [dot, setDot] = useState(0)
  const scroller = useRef(null)

  const featured = useMemo(() => [...charms].sort((a, b) => b.mcap - a.mcap).slice(0, 6), [charms])

  const list = useMemo(() => {
    let l = charms.filter(
      (c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.ticker.toLowerCase().includes(q.toLowerCase()),
    )
    return [...l].sort(TABS.find((t) => t.key === tab).fn)
  }, [charms, tab, q])

  function onScroll() {
    const el = scroller.current
    if (!el) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    if (i !== dot) setDot(i)
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* featured carousel */}
      <div
        ref={scroller}
        onScroll={onScroll}
        className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-1 px-1"
      >
        {featured.map((c) => (
          <div key={c.id} className="snap-center shrink-0 w-full">
            <FeaturedCard charm={c} />
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-1.5 mt-3 mb-6">
        {featured.map((_, i) => (
          <span
            key={i}
            className="h-1.5 rounded-full transition-all"
            style={{ width: i === dot ? 22 : 6, background: i === dot ? 'var(--color-sky-deep)' : 'rgba(20,32,59,.2)' }}
          />
        ))}
      </div>

      {/* explore heading */}
      <h1 className="font-serif text-4xl mb-4">Explore</h1>

      {/* search (optional, subtle) */}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search charms & tickers…"
        className="w-full card px-4 py-2.5 text-sm outline-none mb-4 focus:ring-2 ring-[var(--color-sky-deep)]"
      />

      {/* filter pills */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-5 -mx-1 px-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition ${
              tab === t.key ? 'bg-[rgba(47,125,255,.14)] text-[var(--color-sky-top)]' : 'bg-white/60 text-[var(--color-ink-soft)] hover:bg-white'
            }`}
          >
            <span className="text-xs">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* grid */}
      <div className="grid grid-cols-2 gap-3">
        {list.map((c) => (
          <CharmCard key={c.id} charm={c} />
        ))}
      </div>
      {list.length === 0 && (
        <div className="text-center py-16 text-[var(--color-ink-soft)]">No charms match “{q}”.</div>
      )}
      <div className="h-4" />
    </div>
  )
}
