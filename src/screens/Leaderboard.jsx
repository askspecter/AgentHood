import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Back, Crown } from '../components/icons'

/**
 * Leaderboard — three real boards for ESKA activity.
 *
 *   • Trade volume — USD swapped per trader, summed on every fill (/api/leaderboard)
 *   • Top referral — friends who signed in through your code, de-duped
 *   • Top creator  — coins launched ON ESKA, ranked by the market cap created here
 *
 * All three read real data from /api/leaderboard. Nothing is invented: a board
 * with no activity yet shows an honest "warming up" state and fills in the
 * moment real trades, referrals or launches are recorded.
 */

const TABS = [
  { key: 'volume', label: 'Trade volume' },
  { key: 'referral', label: 'Top referral' },
  { key: 'creator', label: 'Top creator' },
]

const usd = (n) =>
  '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: n >= 1 ? 0 : 2 })

const EMPTY = {
  volume: {
    title: 'Trade volume board is warming up',
    body: 'This ranks the wallets trading the most on ESKA, by real USD swapped. It fills in as trades settle — no placeholder names.',
  },
  referral: {
    title: 'Referral board is warming up',
    body: 'Share your code from Settings. Once friends sign in through your link, the biggest referrers show up here — ranked by real sign-ups.',
  },
  creator: {
    title: 'Creator board is warming up',
    body: 'This ranks people by the coins they launch on ESKA — measured by the market cap created here. It fills in with the first ESKA launches.',
  },
}

export default function Leaderboard() {
  const nav = useNavigate()
  const [tab, setTab] = useState('volume')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/leaderboard?network=robinhood')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled) { setData(j); setError(!j) } })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const rows = data?.[tab] ?? []
  const fmtValue = (r) =>
    tab === 'volume' ? usd(r.score)
      : tab === 'referral' ? `${r.score} ${r.score === 1 ? 'referral' : 'referrals'}`
        : usd(r.score)

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

      {loading ? (
        <div className="card p-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={`flex items-center gap-3 p-3.5 ${i ? 'border-t hairline' : ''}`}>
              <div className="w-7 h-7 rounded-full panel-soft animate-pulse" />
              <div className="flex-1 h-4 rounded panel-soft animate-pulse" />
              <div className="w-16 h-4 rounded panel-soft animate-pulse" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Soon title={EMPTY[tab].title} body={EMPTY[tab].body} />
      ) : (
        <div className="card overflow-hidden">
          {rows.map((r, i) => (
            <div key={r.member || r.display || i} className={`flex items-center gap-3 p-3.5 sm:p-4 ${i ? 'border-t hairline' : ''}`}>
              <Rank n={r.rank} />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{r.display}</div>
                {tab === 'creator' && r.coins != null && (
                  <div className="text-xs text-[var(--color-ink-faint)]">{r.coins} {r.coins === 1 ? 'coin' : 'coins'} launched</div>
                )}
              </div>
              <div className="font-mono num font-semibold shrink-0">{fmtValue(r)}</div>
            </div>
          ))}
        </div>
      )}

      {error && !loading && (
        <p className="text-[11px] text-[var(--color-ink-faint)] mt-3 text-center">Couldn’t reach the leaderboard just now — pull to refresh in a moment.</p>
      )}
    </div>
  )
}

function Rank({ n }) {
  const medal = n === 1 ? '#f6c66b' : n === 2 ? '#cfd3dc' : n === 3 ? '#d9a06b' : null
  return (
    <span
      className="shrink-0 w-7 h-7 grid place-items-center rounded-full font-mono text-xs font-semibold"
      style={medal
        ? { background: medal, color: '#0b0a12' }
        : { background: 'var(--surface-soft)', color: 'var(--color-ink-soft)' }}
    >{n}</span>
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
