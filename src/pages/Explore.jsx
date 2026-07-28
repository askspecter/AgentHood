import { useMemo, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import CharmCard from '../components/CharmCard'
import FeaturedCard from '../components/FeaturedCard'

const TABS = [
  { key: 'trending', label: 'Trending', fn: (a, b) => b.change24 - a.change24 },
  { key: 'top', label: 'Top', fn: (a, b) => b.mcap - a.mcap },
  { key: 'icons', label: 'Icons', fn: (a, b) => b.followers - a.followers },
  { key: 'new', label: 'New', fn: (a, b) => (b.isMine ? 1 : 0) - (a.isMine ? 1 : 0) },
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
      <div className="flex justify-center gap-1.5 mt-4 mb-8">
        {featured.map((_, i) => (
          <span
            key={i}
            className="h-1 rounded-full transition-all"
            style={{ width: i === dot ? 24 : 6, background: i === dot ? 'var(--color-accent)' : 'rgba(255,255,255,.2)' }}
          />
        ))}
      </div>

      {/* explore heading */}
      <div className="eyebrow mb-1">The index</div>
      <h1 className="font-serif text-4xl mb-5">Explore</h1>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search characters and tickers"
        className="w-full card !rounded-full px-5 py-3 text-sm outline-none mb-4 bg-transparent focus:border-[rgba(217,165,82,.5)]"
      />

      {/* filter pills */}
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

      {/* grid */}
      <div className="grid grid-cols-2 gap-3">
        {list.map((c) => (
          <CharmCard key={c.id} charm={c} />
        ))}
      </div>
      {list.length === 0 && (
        <div className="text-center py-16 text-[var(--color-ink-soft)]">Nothing matches "{q}".</div>
      )}
      <div className="h-4" />
    </div>
  )
}
