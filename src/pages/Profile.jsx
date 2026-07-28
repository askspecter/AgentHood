import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import CharmAvatar from '../components/CharmAvatar'
import Sparkline from '../components/Sparkline'
import { usd, num, pct, timeAgo } from '../lib/format'
import { Gift, Gear, Share, XGlyph } from '../components/icons'

export default function Profile() {
  const nav = useNavigate()
  const { wallet, connect, cash, holdings, prices, getCharm, activity, custom, portfolioValue, addCash } = useStore()
  const [tab, setTab] = useState('coins')
  const [flash, setFlash] = useState(false)

  if (!wallet) {
    return (
      <div className="max-w-md mx-auto text-center py-24">
        <div className="mx-auto mb-6 w-16 h-16 rounded-full border border-white/15 grid place-items-center bg-white/4">
          <XGlyph size={22} color="var(--color-ink)" />
        </div>
        <h1 className="font-serif text-3xl mb-2">Your ESKA account</h1>
        <p className="text-[var(--color-ink-soft)] mb-7">Log in with X to see your balance, coins and activity.</p>
        <button onClick={connect} className="btn bg-black text-white border border-white/25 hover:bg-[#111] mx-auto">
          <XGlyph size={14} color="#fff" /> Log in with X
        </button>
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
    <div className="max-w-2xl mx-auto">
      {/* page header */}
      <div className="flex items-start justify-between pt-2 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full grid place-items-center font-serif text-2xl shrink-0 border border-white/20"
            style={{ background: 'radial-gradient(120% 120% at 30% 22%, #6b5a9e, #201a38)' }}>Y</div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xl">{wallet.handle}</span>
              <Share size={14} />
            </div>
            <span className="inline-flex items-center gap-1.5 mt-1.5 chip">
              <XGlyph size={10} color="var(--color-ink)" /> Verified
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={doAddCash}
            className="w-10 h-10 grid place-items-center rounded-full border border-[rgba(217,165,82,.45)]"
            style={{ background: 'var(--color-accent-dim)' }} title="Rewards">
            <Gift size={18} stroke="var(--color-accent-hi)" />
          </button>
          <button onClick={() => nav('/settings')} className="w-10 h-10 grid place-items-center rounded-full bg-white/5 border border-white/15" title="Settings">
            <Gear size={18} />
          </button>
        </div>
      </div>

      {/* total */}
      <div className="text-center mb-6">
        <div className="eyebrow mb-2">Total</div>
        <BigMoney value={total} />
        {flash && <div className="text-[var(--color-up)] text-sm font-semibold mt-2 flash">+$1,000.00 demo USDC added</div>}
      </div>

      {/* cash balance card */}
      <div className="card p-4 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 grid place-items-center rounded-xl font-mono font-bold text-[var(--color-accent-hi)] border border-[rgba(217,165,82,.4)]"
              style={{ background: 'var(--color-accent-dim)' }}>$</span>
            <span className="text-[var(--color-ink-soft)] font-medium">Cash balance</span>
          </div>
          <span className="font-mono font-bold text-lg">${cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <button onClick={doAddCash} className="btn btn-accent w-full mt-3 !py-3">Add cash</button>
      </div>

      {/* tabs */}
      <div className="flex gap-6 border-b hairline mb-6">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`pb-2.5 -mb-px border-b-2 capitalize font-semibold transition ${
              tab === t ? 'border-[var(--color-accent)] text-[var(--color-ink)]' : 'border-transparent text-[var(--color-ink-soft)]'
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
            action={<button onClick={doAddCash} className="btn btn-primary">Add cash</button>}
          />
        ) : (
          <div className="card divide-y divide-white/8 overflow-hidden">
            {positions.map(({ charm, h, value, pnl, pnlPct }) => (
              <Link key={charm.id} to={`/c/${charm.id}`} className="flex items-center gap-3 p-4 hover:bg-white/4">
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
          <Empty title="No creations yet" subtitle="Mint a character and it will show up here."
            action={<button onClick={() => nav('/create')} className="btn btn-primary">Create a character</button>} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {custom.map((c) => (
              <Link key={c.id} to={`/c/${c.id}`} className="card p-4 flex flex-col items-center text-center hover:-translate-y-0.5 transition-transform">
                <CharmAvatar charm={c} size={64} />
                <div className="font-serif text-lg mt-2">{c.name}</div>
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
          <div className="card divide-y divide-white/8 overflow-hidden">
            {activity.slice(0, 24).map((a, i) => {
              const charm = a.id ? getCharm(a.id) : null
              const verb = a.type === 'buy' ? 'Bought' : a.type === 'sell' ? 'Sold' : a.type === 'launch' ? 'Minted' : 'Added cash'
              const color = a.type === 'buy' ? 'text-[var(--color-up)]' : a.type === 'sell' ? 'text-[var(--color-down)]' : ''
              return (
                <div key={i} className="flex items-center gap-3 p-3 text-sm">
                  {charm
                    ? <CharmAvatar charm={charm} size={32} />
                    : <span className="w-8 h-8 grid place-items-center rounded-full font-mono font-bold text-[var(--color-accent-hi)] border border-[rgba(217,165,82,.35)]" style={{ background: 'var(--color-accent-dim)' }}>$</span>}
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
        <Empty title="Gallery is empty" subtitle="Media you generate for your characters shows up here." />
      )}
    </div>
  )
}

function BigMoney({ value }) {
  const [int, dec] = value.toFixed(2).split('.')
  const withCommas = Number(int).toLocaleString()
  return (
    <div className="font-serif leading-none flex items-start justify-center">
      <span className="text-3xl mt-1">$</span>
      <span className="text-6xl">{withCommas}</span>
      <span className="text-4xl mt-1 text-[var(--color-ink-soft)]">.{dec}</span>
    </div>
  )
}

function Empty({ title, subtitle, action }) {
  return (
    <div className="text-center py-14">
      <div className="mx-auto mb-5 w-14 h-14 rounded-full border border-[rgba(217,165,82,.4)]"
        style={{ boxShadow: '0 0 30px -8px rgba(217,165,82,.45), inset 0 0 18px -6px rgba(217,165,82,.4)' }} />
      <h3 className="font-serif text-3xl mb-1">{title}</h3>
      <p className="text-[var(--color-ink-soft)] max-w-xs mx-auto mb-6">{subtitle}</p>
      {action}
    </div>
  )
}
