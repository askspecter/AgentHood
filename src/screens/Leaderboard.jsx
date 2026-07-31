import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Back, Crown, Verified } from '../components/icons'
import { usd, num } from '../lib/format'

/**
 * Leaderboard — three boards, all live and all real.
 *
 * Every board ranks actual ESKA-native activity, recorded as it happens:
 *  • Top creator — coins launched here, ranked by the market cap they've created.
 *  • Trade volume — cumulative WETH traded per account.
 *  • Top referral — friends brought in through your ?ref= link.
 * None invent names: a board simply shows a "warming up" state until there's
 * something real to rank.
 */

const NETWORK = 'robinhood'

const TABS = [
  { key: 'creator', label: 'Top creator' },
  { key: 'volume', label: 'Trade volume' },
  { key: 'referral', label: 'Top referral' },
]

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')

const EMPTY = {
  creator: {
    title: 'Creator board is warming up',
    body: "This ranks people by the coins they launch on ESKA — measured by the market cap they create here. It fills in as coins are launched; launch one to take the top spot.",
  },
  volume: {
    title: 'Trade volume board is warming up',
    body: 'This ranks the accounts trading the most on ESKA, by real WETH volume as swaps settle on-chain — no placeholder names. It fills in as trading picks up here.',
  },
  referral: {
    title: 'Referral board is warming up',
    body: 'Share your referral link from the Referral page. Once friends sign in through it, the biggest referrers show up here — ranked by real sign-ups, nothing invented.',
  },
}

export default function Leaderboard() {
  const nav = useNavigate()
  const [tab, setTab] = useState('creator')
  const [data, setData] = useState({}) // board -> { loading, rows }

  // Fetch the active board. Depends on `tab` ONLY — not `data`: with `data` in
  // the deps, setData(loading) re-triggered the effect, whose cleanup cancelled
  // the in-flight fetch, so the result was always discarded and the board hung
  // on skeletons forever. Now the fetch runs to completion.
  useEffect(() => {
    let cancelled = false
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 14000) // never hang on skeletons
    // Keep any prior rows visible while refreshing; only show skeletons first time.
    setData((d) => (d[tab] ? d : { ...d, [tab]: { loading: true, rows: [] } }))
    fetch(`/api/leaderboard?board=${tab}&network=${NETWORK}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled) setData((d) => ({ ...d, [tab]: { loading: false, rows: Array.isArray(j?.rows) ? j.rows : [], kv: j?.kv, error: !j } })) })
      .catch(() => { if (!cancelled) setData((d) => ({ ...d, [tab]: { loading: false, rows: [], error: true } })) })
      .finally(() => clearTimeout(timer))
    return () => { cancelled = true; clearTimeout(timer); ctrl.abort() }
  }, [tab])

  const cur = data[tab]
  const retry = () => setData((d) => { const n = { ...d }; delete n[tab]; return n })

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

      {!cur || cur.loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="card h-16 animate-pulse opacity-40" />)}
        </div>
      ) : cur.rows.length > 0 ? (
        <div className="space-y-2">
          {cur.rows.map((r) => <Row key={r.rank} board={tab} row={r} />)}
          <p className="text-xs text-[var(--color-ink-faint)] text-center pt-3">{FOOTNOTE[tab]}</p>
        </div>
      ) : cur.error ? (
        <div className="card text-center py-14 px-6">
          <h3 className="font-serif text-2xl mb-1">Couldn’t load the board</h3>
          <p className="text-[var(--color-ink-soft)] max-w-sm mx-auto mb-5">The network was slow just now. Give it another try.</p>
          <button onClick={retry} className="btn btn-primary mx-auto">Try again</button>
        </div>
      ) : cur.kv === false ? (
        <Soon
          title="Leaderboard storage isn’t connected"
          body="The boards record real activity in Vercel KV. Connect a KV (Upstash Redis) store to this project in Vercel → Storage, and the volume, referral and creator boards start filling in immediately."
        />
      ) : (
        <Soon title={EMPTY[tab].title} body={EMPTY[tab].body} />
      )}
    </div>
  )
}

const FOOTNOTE = {
  creator: 'Ranked by total market cap of coins launched on ESKA · priced live on-chain',
  volume: 'Ranked by cumulative WETH traded on ESKA · updates as swaps settle',
  referral: 'Ranked by friends who signed in through your referral link',
}

function Row({ board, row }) {
  const medal = row.rank <= 3
  const rank = (
    <span className={`grid place-items-center w-8 h-8 rounded-lg shrink-0 font-mono text-sm ${medal ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-faint)]'}`}
      style={medal ? { background: 'var(--holo)' } : { background: 'var(--color-paper-2)' }}>
      {row.rank}
    </span>
  )

  if (board === 'volume') {
    return (
      <div className="card flex items-center gap-3 p-3.5">
        {rank}
        <div className="flex-1 min-w-0"><span className="font-semibold truncate">@{row.handle}</span></div>
        <div className="text-right shrink-0">
          <div className="font-mono num">{row.volumeUsd != null ? usd(row.volumeUsd) : `${num(row.volumeWeth)} WETH`}</div>
          <div className="eyebrow">volume traded</div>
        </div>
      </div>
    )
  }

  if (board === 'referral') {
    return (
      <div className="card flex items-center gap-3 p-3.5">
        {rank}
        <div className="flex-1 min-w-0"><span className="font-semibold truncate">@{row.code}</span></div>
        <div className="text-right shrink-0">
          <div className="font-mono num">{num(row.count)}</div>
          <div className="eyebrow">friend{row.count === 1 ? '' : 's'} joined</div>
        </div>
      </div>
    )
  }

  // creator
  const name = row.handle ? `@${row.handle}` : short(row.deployer)
  return (
    <div className="card flex items-center gap-3 p-3.5">
      {rank}
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
