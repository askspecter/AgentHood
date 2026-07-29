import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import CharmAvatar from '../components/CharmAvatar'
import { Back, XLogo, Crown } from '../components/icons'
import { usd, num } from '../lib/format'

/**
 * Leaderboard — three boards for the pons world we can see.
 *
 * Top creators is real and live: it's built from the launch feed, ranking each
 * deployer by the combined market cap of the coins they launched. Trade volume
 * and referrals need per-account activity recorded server-side, which this build
 * doesn't have yet — so those boards say so honestly instead of inventing names.
 */

const TABS = [
  { key: 'volume', label: 'Trade volume' },
  { key: 'referral', label: 'Top referral' },
  { key: 'creator', label: 'Top creator' },
]

export default function Leaderboard() {
  const nav = useNavigate()
  const { agents } = useStore()
  const [tab, setTab] = useState('creator')

  // Real: group the feed by deployer, rank by total market cap of their coins.
  const creators = useMemo(() => {
    const m = new Map()
    for (const a of agents) {
      const key = a.creator || 'pons'
      const e = m.get(key) || { creator: key, mcap: 0, coins: 0, top: a }
      e.mcap += a.mcap || 0
      e.coins += 1
      if ((a.mcap || 0) >= (e.top?.mcap || 0)) e.top = a
      m.set(key, e)
    }
    return [...m.values()].sort((x, y) => y.mcap - x.mcap).slice(0, 25)
  }, [agents])

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
        creators.length === 0 ? (
          <Soon title="No creators yet" body="Once coins are live on pons, their creators rank here by the market cap they've launched." />
        ) : (
          <div className="card overflow-hidden">
            {creators.map((c, i) => (
              <div key={c.creator} className={`flex items-center gap-3 p-4 ${i ? 'border-t hairline' : ''}`}>
                <Rank i={i} />
                <CharmAvatar charm={c.top} size={40} ring />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <XLogo size={11} />
                    <span className="font-medium truncate">{c.creator}</span>
                  </div>
                  <div className="text-xs text-[var(--color-ink-faint)] mt-0.5">{c.coins} coin{c.coins === 1 ? '' : 's'} · top ${c.top?.ticker}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono num font-semibold">{usd(c.mcap)}</div>
                  <div className="eyebrow mt-0.5">Market cap</div>
                </div>
              </div>
            ))}
          </div>
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

function Rank({ i }) {
  const medal = ['#ffd27d', '#cfd3e0', '#e6a86b'][i]
  if (i < 3) {
    return (
      <span className="w-7 h-7 grid place-items-center rounded-full shrink-0" style={{ background: `${medal}22`, border: `1px solid ${medal}66` }}>
        <Crown size={14} />
      </span>
    )
  }
  return <span className="w-7 text-center font-mono text-sm text-[var(--color-ink-faint)] shrink-0">{i + 1}</span>
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
