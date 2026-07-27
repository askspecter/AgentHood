import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import CharmCard from '../components/CharmCard'

const SORTS = {
  hot: { label: '🔥 Hot', fn: (a, b) => b.change24 - a.change24 },
  top: { label: '💎 Top', fn: (a, b) => b.mcap - a.mcap },
  new: { label: '✨ New', fn: (a, b) => (b.isMine ? 1 : 0) - (a.isMine ? 1 : 0) },
  fans: { label: '❤️ Loved', fn: (a, b) => b.followers - a.followers },
}

export default function Explore() {
  const { charms } = useStore()
  const [sort, setSort] = useState('hot')
  const [q, setQ] = useState('')

  const list = useMemo(() => {
    let l = charms.filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q.toLowerCase()) ||
        c.ticker.toLowerCase().includes(q.toLowerCase()) ||
        c.vibe.some((v) => v.includes(q.toLowerCase())),
    )
    return [...l].sort(SORTS[sort].fn)
  }, [charms, sort, q])

  return (
    <div>
      <div className="flex flex-col gap-4 mb-6">
        <div>
          <h1 className="font-serif text-4xl">Explore</h1>
          <p className="text-[var(--color-ink-soft)]">Coins that feel alive. Find your next icon.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search charms, tickers, vibes…"
            className="flex-1 card px-4 py-2.5 text-sm outline-none focus:ring-2 ring-[var(--color-sky-deep)]"
          />
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {Object.entries(SORTS).map(([k, v]) => (
              <button
                key={k}
                onClick={() => setSort(k)}
                className={`btn text-sm !py-2 ${sort === k ? 'btn-sky' : 'btn-ghost'}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((c) => (
          <CharmCard key={c.id} charm={c} />
        ))}
      </div>
      {list.length === 0 && (
        <div className="text-center py-20 text-[var(--color-ink-soft)]">No charms match “{q}”.</div>
      )}
    </div>
  )
}
