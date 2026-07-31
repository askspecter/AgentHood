import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Back, Crown, Verified } from '../components/icons'
import { usd } from '../lib/format'

/**
 * Leaderboard — three boards for activity on ESKA.
 *
 * The Creator board is live: it ranks people by the coins they've launched here,
 * priced on-chain and totalled by the market cap they've created. The volume and
 * referral boards rank real swaps and real referral sign-ups — data we don't
 * index yet — so they honestly show a "warming up" state until there is
 * something to rank. None of them invent names.
 */

const NETWORK = 'robinhood'

const TABS = [
  { key: 'creator', label: 'Top creator' },
  { key: 'volume', label: 'Trade volume' },
  { key: 'referral', label: 'Top referral' },
]

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')

export default function Leaderboard() {
  const nav = useNavigate()
  const [tab, setTab] = useState('creator')
  const [creator, setCreator] = useState(null) // { rows, loading, failed }

  useEffect(() => {
    if (tab !== 'creator' || creator) return
    let cancelled = false
    setCreator({ loading: true, rows: [] })
    fetch(`/api/leaderboard?board=creator&network=${NETWORK}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled) setCreator({ loading: false, rows: Array.isArray(j?.rows) ? j.rows : [] }) })
      .catch(() => { if (!cancelled) setCreator({ loading: false, rows: [], failed: true }) })
    return () => { cancelled = true }
  }, [tab, creator])

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => nav(-1)} className="grid place-items-center w-10 h-10 rounded-lg border hairline hover:bg-[var(--color-paper-2)]"><Back size={18} /></button>
        <h1 className="font-serif text-3xl">Leaderboard</h1>
      </div>

      <div className="seg no-scrollbar mb-6 flex overflow-x-auto max-w-full">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`shrink-0 ${tab === t.key ? 'on' : ''}`}>{t.label}</button>
        ))}
      </div>

      {tab === 'creator' && (
        creator?.loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="card h-16 animate-pulse opacity-40" />)}
          </div>
        ) : creator && creator.rows.length > 0 ? (
          <div className="space-y-2">
            {creator.rows.map((r) => <CreatorRow key={r.rank} row={r} />)}
            <p className="text-xs text-[var(--color-ink-faint)] text-center pt-3">
              Ranked by total market cap of coins launched on ESKA · priced live on-chain
            </p>
          </div>
        ) : (
          <Soon
            title="Creator board is warming up"
            body="This ranks people by the coins they launch on ESKA — measured by the market cap they create here. It fills in as coins are launched; launch one to take the top spot."
          />
        )
      )}

      {tab === 'volume' && (
        <Soon
          title="Trade volume board is warming up"
          body="This ranks the wallets trading the most on ESKA. It counts real swaps as they settle on-chain — no placeholder names — so it fills in as trading picks up here."
        />
      )}

      {tab === 'referral' && (
        <Soon
          title="Referral board is warming up"
          body="Share your referral code from Settings. Once friends sign in through it, the biggest referrers show up here — ranked by real sign-ups, nothing invented."
        />
      )}
    </div>
  )
}

function CreatorRow({ row }) {
  const name = row.handle ? `@${row.handle}` : short(row.deployer)
  const medal = row.rank <= 3
  return (
    <div className="card flex items-center gap-3 p-3.5">
      <span className={`grid place-items-center w-8 h-8 rounded-lg shrink-0 font-mono text-sm ${medal ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-faint)]'}`}
        style={medal ? { background: 'var(--holo)' } : { background: 'var(--color-paper-2)' }}>
        {row.rank}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-semibold truncate">{name}</span>
          {row.official && <Verified size={13} gold />}
        </div>
        <div className="text-xs text-[var(--color-ink-faint)] font-mono truncate">
          {row.coins} coin{row.coins === 1 ? '' : 's'}{row.topSymbol ? ` · top $${String(row.topSymbol).replace(/^\$/, '')}` : ''}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-mono num">{row.mcapUsd > 0 ? usd(row.mcapUsd) : '—'}</div>
        <div className="eyebrow">mcap created</div>
      </div>
    </div>
  )
}

function Soon({ title, body }) {
  return (
    <div className="card text-center py-14 px-6">
      <div className="mx-auto mb-4 w-12 h-12 rounded-full grid place-items-center" style={{ background: 'var(--holo)' }}>
        <Crown size={20} />
      </div>
      <h3 className="font-serif text-2xl mb-1">{title}</h3>
      <p className="text-[var(--color-ink-soft)] max-w-sm mx-auto">{body}</p>
    </div>
  )
}
