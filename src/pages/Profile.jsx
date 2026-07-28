import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import CharmAvatar from '../components/CharmAvatar'
import Sparkline from '../components/Sparkline'
import { usd, num, pct, timeAgo } from '../lib/format'
import { Gift, Gear, Share, PlusSquare, Verified } from '../components/icons'

export default function Profile() {
  const nav = useNavigate()
  const { wallet, connect, cash, holdings, prices, getCharm, activity, custom, portfolioValue, addCash } = useStore()
  const [tab, setTab] = useState('coins')
  const [flash, setFlash] = useState(false)

  if (!wallet) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <div className="text-5xl mb-4">👤</div>
        <h1 className="font-serif text-3xl mb-2">Your Charms account</h1>
        <p className="text-[var(--color-ink-soft)] mb-6">Log in to see your balance, coins and activity.</p>
        <button onClick={() => connect('wallet')} className="btn btn-primary">Log in</button>
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

  function doAddCash() {
    addCash(1000)
    setFlash(true)
    setTimeout(() => setFlash(false), 1800)
  }

  const TABS = ['coins', 'creations', 'activity', 'gallery']

  return (
    <div>
      {/* page header */}
      <div className="flex items-start justify-between pt-2 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full grid place-items-center text-2xl shrink-0"
            style={{ background: 'linear-gradient(135deg,#8FB8F6,#c9a7f5)' }}>🧑</div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xl">{wallet.handle}</span>
              <Share size={15} />
            </div>
            <span className="inline-flex items-center gap-1.5 mt-1 bg-white/70 rounded-full px-2.5 py-0.5 text-xs font-semibold">
              <span className="grid place-items-center w-4 h-4 rounded-full bg-black text-white text-[9px]">𝕏</span>
              Verified
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={doAddCash} className="w-10 h-10 grid place-items-center rounded-full bg-[var(--color-sky-deep)] shadow-md" title="Rewards"><Gift size={19} /></button>
          <button onClick={() => nav('/settings')} className="w-10 h-10 grid place-items-center rounded-full bg-white shadow-sm" title="Settings"><Gear size={19} /></button>
        </div>
      </div>

      {/* total */}
      <div className="text-center mb-5">
        <div className="text-[var(--color-ink-soft)] font-semibold mb-1">Total</div>
        <BigMoney value={total} />
        {flash && <div className="text-[var(--color-up)] text-sm font-semibold mt-1 flash">+$1,000.00 demo USDC added</div>}
      </div>

      {/* cash balance card */}
      <div className="card p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 grid place-items-center rounded-xl bg-[rgba(47,125,255,.12)] font-mono font-bold text-[var(--color-sky-top)]">$</span>
            <span className="text-[var(--color-ink-soft)] font-medium">Cash balance</span>
          </div>
          <span className="font-bold text-lg">${cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <button onClick={doAddCash} className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-[var(--color-sky-top)] bg-[rgba(47,125,255,.1)] hover:bg-[rgba(47,125,255,.16)] transition">
          <PlusSquare size={20} /> Add cash
        </button>
      </div>

      {/* tabs */}
      <div className="flex gap-5 border-b border-[rgba(20,32,59,.1)] mb-5">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`pb-2.5 -mb-px border-b-2 capitalize font-semibold transition ${
              tab === t ? 'border-[var(--color-ink)] text-[var(--color-ink)]' : 'border-transparent text-[var(--color-ink-soft)]'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* tab content */}
      {tab === 'coins' && (
        positions.length === 0 ? (
          <Empty
            title="No coins yet"
            subtitle="Add cash, then discover and trade a character coin."
            action={<button onClick={doAddCash} className="btn btn-sky">Add cash</button>}
          />
        ) : (
          <div className="card divide-y divide-[rgba(20,32,59,.07)] overflow-hidden">
            {positions.map(({ charm, h, value, pnl, pnlPct }) => (
              <Link key={charm.id} to={`/c/${charm.id}`} className="flex items-center gap-3 p-4 hover:bg-white/60">
                <CharmAvatar charm={charm} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{charm.name}</div>
                  <div className="text-xs text-[var(--color-ink-soft)] font-mono">{num(h.units)} {charm.ticker}</div>
                </div>
                <Sparkline data={charm.history} up={pnl >= 0} width={70} height={28} />
                <div className="text-right">
                  <div className="font-mono font-semibold">{usd(value)}</div>
                  <div className={`text-xs font-semibold ${pnl >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}`}>{pct(pnlPct)}</div>
                </div>
              </Link>
            ))}
          </div>
        )
      )}

      {tab === 'creations' && (
        custom.length === 0 ? (
          <Empty title="No creations yet" subtitle="Launch a charm and it will show up here."
            action={<button onClick={() => nav('/create')} className="btn btn-sky">Create a charm</button>} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {custom.map((c) => (
              <Link key={c.id} to={`/c/${c.id}`} className="card p-4 flex flex-col items-center text-center hover:-translate-y-0.5 transition-transform">
                <CharmAvatar charm={c} size={64} />
                <div className="font-semibold mt-2">{c.name}</div>
                <div className="font-mono text-xs text-[var(--color-ink-soft)]">${c.ticker}</div>
              </Link>
            ))}
          </div>
        )
      )}

      {tab === 'activity' && (
        activity.length === 0 ? (
          <Empty title="No activity yet" subtitle="Your deposits and trades will appear here." />
        ) : (
          <div className="card divide-y divide-[rgba(20,32,59,.07)] overflow-hidden">
            {activity.slice(0, 24).map((a, i) => {
              const charm = a.id ? getCharm(a.id) : null
              const verb = a.type === 'buy' ? 'Bought' : a.type === 'sell' ? 'Sold' : a.type === 'launch' ? 'Launched' : 'Added cash'
              const color = a.type === 'buy' ? 'text-[var(--color-up)]' : a.type === 'sell' ? 'text-[var(--color-down)]' : ''
              return (
                <div key={i} className="flex items-center gap-3 p-3 text-sm">
                  {charm ? <CharmAvatar charm={charm} size={32} /> : <span className="w-8 h-8 grid place-items-center rounded-full bg-[rgba(47,125,255,.12)]">💰</span>}
                  <div className="flex-1">
                    <span className={`font-semibold ${color}`}>{verb}</span> {charm ? charm.name : 'to balance'}
                    {a.units != null && <span className="font-mono text-[var(--color-ink-soft)]"> · {num(a.units)} {charm?.ticker}</span>}
                  </div>
                  {a.usd != null && <span className="font-mono">{usd(a.usd)}</span>}
                  <span className="text-xs text-[var(--color-ink-soft)] w-8 text-right">{timeAgo(a.ts)}</span>
                </div>
              )
            })}
          </div>
        )
      )}

      {tab === 'gallery' && (
        <Empty title="Gallery is empty" subtitle="Media you generate for your charms shows up here." />
      )}
    </div>
  )
}

function BigMoney({ value }) {
  const [int, dec] = value.toFixed(2).split('.')
  const withCommas = Number(int).toLocaleString()
  return (
    <div className="font-serif leading-none flex items-start justify-center">
      <span className="text-3xl mt-1 text-[var(--color-ink)]">$</span>
      <span className="text-6xl text-[var(--color-ink)]">{withCommas}</span>
      <span className="text-4xl mt-1 text-[var(--color-ink-soft)]">.{dec}</span>
    </div>
  )
}

function Empty({ title, subtitle, action }) {
  return (
    <div className="text-center py-14">
      <div className="mx-auto mb-4 w-14 h-14 rounded-full border-[6px] border-[rgba(47,125,255,.18)]" />
      <h3 className="font-serif text-3xl mb-1">{title}</h3>
      <p className="text-[var(--color-ink-soft)] max-w-xs mx-auto mb-5">{subtitle}</p>
      {action}
    </div>
  )
}
