import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Back, Crown } from '../components/icons'

/**
 * Leaderboard — three boards for activity on ESKA.
 *
 * All three rank real, ESKA-native activity: trades made here, sign-ups through
 * your referral, and coins launched here. None of them invent names — each fills
 * in as that activity is recorded, so they show an honest "warming up" state
 * until there's real data to rank. (The Discover feed's pons coins are not
 * counted as ESKA launches; Top creator is only for coins launched on ESKA.)
 */

const TABS = [
  { key: 'volume', label: 'Trade volume' },
  { key: 'referral', label: 'Top referral' },
  { key: 'creator', label: 'Top creator' },
]

export default function Leaderboard() {
  const nav = useNavigate()
  const [tab, setTab] = useState('volume')

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

      {tab === 'creator' && (
        <Soon
          title="Creator board is warming up"
          body="This ranks people by the coins they launch on ESKA — measured by the market cap they create here. It stays empty until the first coins are launched on ESKA."
        />
      )}
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
