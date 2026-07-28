import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import CharmAvatar from '../components/CharmAvatar'
import Sparkline from '../components/Sparkline'
import { usd, bal, num, pct, timeAgo } from '../lib/format'
import { Gear, XGlyph, Coin } from '../components/icons'

export default function Profile() {
  const nav = useNavigate()
  const { wallet, connect, cash, holdings, prices, getCharm, activity, custom, portfolioValue, addCash } = useStore()
  const [tab, setTab] = useState('coins')
  const [flash, setFlash] = useState(false)

  if (!wallet) {
    return (
      <div className="max-w-md mx-auto text-center py-24">
        <div className="orb-spin mx-auto mb-6 w-14 h-14 rounded-2xl grid place-items-center" style={{ background: 'var(--holo)' }}><XGlyph size={20} color="#0b0a12" /></div>
        <h1 className="font-serif text-3xl mb-2">Your portfolio</h1>
        <p className="text-[var(--color-ink-soft)] mb-7">Sign in with X to see your balance, coins and activity.</p>
        <button onClick={connect} className="btn btn-primary mx-auto">Sign in with <XGlyph size={13} color="#fff" /></button>
      </div>
    )
  }

  const total = cash + portfolioValue
  const positions = Object.entries(holdings).map(([id, h]) => {
    const charm = getCharm(id)
    const price = prices[id] ?? charm?.price ?? 0
    const value = h.units * price
    const pnl = value - h.cost
    return { charm, h, value, pnl, pnlPct: h.cost ? (pnl / h.cost) * 100 : 0 }
  }).filter((p) => p.charm).sort((a, b) => b.value - a.value)

  function doAddCash() { addCash(1000); setFlash(true); setTimeout(() => setFlash(false), 1800) }
  const TABS = ['coins', 'creations', 'activity']

  return (
    <div className="max-w-3xl mx-auto">
      {/* header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="orb-spin w-12 h-12 rounded-full grid place-items-center font-bold text-xl"
            style={{ background: 'var(--holo)', color: '#0b0a12' }}>{(wallet.handle?.replace(/^@/, '')[0] || 'Y').toUpperCase()}</span>
          <div>
            <div className="font-semibold text-lg">{wallet.handle}</div>
            <span className="inline-flex items-center gap-1.5 chip"><XGlyph size={10} color="var(--color-ink-soft)" /> Verified</span>
          </div>
        </div>
        <button onClick={() => nav('/settings')} className="grid place-items-center w-10 h-10 rounded-lg border hairline hover:bg-[var(--color-paper-2)]"><Gear size={18} /></button>
      </div>

      {/* balance card */}
      <div className="card p-6 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-1">
            <div className="eyebrow mb-1">Net worth</div>
            <div className="font-mono num text-3xl font-semibold">{bal(total)}</div>
            {flash && <div className="text-[var(--color-up)] text-xs font-medium mt-1 flash">+$1,000 added</div>}
          </div>
          <Mini label="Cash" value={bal(cash)} />
          <Mini label="In coins" value={bal(portfolioValue)} />
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={doAddCash} className="btn btn-primary">Add cash</button>
          <Link to="/" className="btn btn-secondary">Discover coins</Link>
        </div>
      </div>

      {/* tabs */}
      <div className="seg mb-5">
        {TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={`capitalize ${tab === t ? 'on' : ''}`}>{t}</button>)}
      </div>

      {tab === 'coins' && (positions.length === 0 ? (
        <Empty title="No coins yet" subtitle="Add cash, then discover and trade a character coin." action={<button onClick={doAddCash} className="btn btn-primary">Add cash</button>} />
      ) : (
        <div className="card overflow-hidden">
          {positions.map(({ charm, h, value, pnl, pnlPct }, i) => (
            <Link key={charm.id} to={`/c/${charm.id}`} className={`flex items-center gap-3 p-4 hover:bg-[var(--color-paper-2)] ${i ? 'border-t hairline' : ''}`}>
              <CharmAvatar charm={charm} size={40} />
              <div className="flex-1 min-w-0">
                <div className="font-medium">{charm.name}</div>
                <div className="text-xs text-[var(--color-ink-faint)] font-mono num">{num(h.units)} {charm.ticker}</div>
              </div>
              <Sparkline data={charm.history} up={pnl >= 0} width={64} height={26} />
              <div className="text-right">
                <div className="font-mono num font-medium">{usd(value)}</div>
                <div className={`text-xs font-mono num ${pnl >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}`}>{pct(pnlPct)}</div>
              </div>
            </Link>
          ))}
        </div>
      ))}

      {tab === 'creations' && (custom.length === 0 ? (
        <Empty title="No creations yet" subtitle="Mint a character and it will show up here." action={<button onClick={() => nav('/create')} className="btn btn-primary">Create a character</button>} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {custom.map((c) => (
            <Link key={c.id} to={`/c/${c.id}`} className="card card-hover p-4 flex flex-col items-center text-center">
              <CharmAvatar charm={c} size={56} />
              <div className="font-medium mt-2">{c.name}</div>
              <div className="font-mono text-xs text-[var(--color-ink-faint)]">${c.ticker}</div>
            </Link>
          ))}
        </div>
      ))}

      {tab === 'activity' && (activity.length === 0 ? (
        <Empty title="No activity yet" subtitle="Your deposits and trades will appear here." />
      ) : (
        <div className="card overflow-hidden">
          {activity.slice(0, 24).map((a, i) => {
            const charm = a.id ? getCharm(a.id) : null
            const verb = a.type === 'buy' ? 'Bought' : a.type === 'sell' ? 'Sold' : a.type === 'launch' ? 'Minted' : 'Added cash'
            const color = a.type === 'buy' ? 'text-[var(--color-up)]' : a.type === 'sell' ? 'text-[var(--color-down)]' : ''
            return (
              <div key={i} className={`flex items-center gap-3 p-3.5 text-sm ${i ? 'border-t hairline' : ''}`}>
                {charm ? <CharmAvatar charm={charm} size={30} /> : <span className="w-8 h-8 grid place-items-center rounded-full panel-soft text-[var(--color-ink-soft)]"><Coin size={16} /></span>}
                <div className="flex-1"><span className={`font-medium ${color}`}>{verb}</span> {charm ? charm.name : 'to balance'}{a.units != null && <span className="font-mono num text-[var(--color-ink-faint)]"> · {num(a.units)} {charm?.ticker}</span>}</div>
                {a.usd != null && <span className="font-mono num">{usd(a.usd)}</span>}
                <span className="text-xs text-[var(--color-ink-faint)] w-8 text-right">{timeAgo(a.ts)}</span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function Mini({ label, value }) {
  return (
    <div>
      <div className="eyebrow mb-1">{label}</div>
      <div className="font-mono num text-lg font-semibold">{value}</div>
    </div>
  )
}

function Empty({ title, subtitle, action }) {
  return (
    <div className="card text-center py-14 px-6">
      <div className="mx-auto mb-4 w-12 h-12 rounded-full border-2 border-dashed border-[var(--color-line-2)]" />
      <h3 className="font-serif text-2xl mb-1">{title}</h3>
      <p className="text-[var(--color-ink-soft)] max-w-xs mx-auto mb-5">{subtitle}</p>
      {action}
    </div>
  )
}
