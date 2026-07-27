import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import CharmAvatar from '../components/CharmAvatar'
import Sparkline from '../components/Sparkline'
import { usd, num, pct, timeAgo } from '../lib/format'

export default function Profile() {
  const { wallet, connect, cash, holdings, prices, getCharm, activity, custom, portfolioValue } = useStore()

  if (!wallet) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <div className="text-5xl mb-4">👤</div>
        <h1 className="font-serif text-3xl mb-2">Your Charms wallet</h1>
        <p className="text-[var(--color-ink-soft)] mb-6">Connect to see your holdings, launches and activity. You’ll start with $1,000 demo USDC.</p>
        <button onClick={() => connect('wallet')} className="btn btn-primary">Connect</button>
      </div>
    )
  }

  const positions = Object.entries(holdings).map(([id, h]) => {
    const charm = getCharm(id)
    const price = prices[id] ?? charm?.price ?? 0
    const value = h.units * price
    const pnl = value - h.cost
    const pnlPct = h.cost ? (pnl / h.cost) * 100 : 0
    return { charm, h, price, value, pnl, pnlPct }
  }).filter((p) => p.charm).sort((a, b) => b.value - a.value)

  const total = cash + portfolioValue

  return (
    <div>
      {/* header */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl grid place-items-center text-2xl" style={{ background: 'linear-gradient(135deg,#CBE2FC,#8FB8F6)' }}>👤</div>
          <div>
            <div className="font-serif text-2xl">{wallet.handle}</div>
            <div className="font-mono text-xs text-[var(--color-ink-soft)]">{wallet.address}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-[rgba(20,32,59,.08)]">
          <Stat label="Net worth" value={usd(total)} big />
          <Stat label="Cash" value={usd(cash)} />
          <Stat label="In charms" value={usd(portfolioValue)} />
        </div>
      </div>

      {/* holdings */}
      <h2 className="font-serif text-2xl mb-3">Holdings</h2>
      {positions.length === 0 ? (
        <div className="card p-8 text-center text-[var(--color-ink-soft)] mb-8">
          You don’t hold any charms yet. <Link className="underline" to="/">Find one you believe in →</Link>
        </div>
      ) : (
        <div className="card divide-y divide-[rgba(20,32,59,.07)] mb-8 overflow-hidden">
          {positions.map(({ charm, h, price, value, pnl, pnlPct }) => (
            <Link key={charm.id} to={`/c/${charm.id}`} className="flex items-center gap-3 p-4 hover:bg-white/60">
              <CharmAvatar charm={charm} size={44} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{charm.name}</div>
                <div className="text-xs text-[var(--color-ink-soft)] font-mono">{num(h.units)} {charm.ticker}</div>
              </div>
              <Sparkline data={charm.history} up={pnl >= 0} width={80} height={30} />
              <div className="text-right">
                <div className="font-mono font-semibold">{usd(value)}</div>
                <div className={`text-xs font-semibold ${pnl >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}`}>{pct(pnlPct)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* your launches */}
      {custom.length > 0 && (
        <>
          <h2 className="font-serif text-2xl mb-3">Your launches</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
            {custom.map((c) => (
              <Link key={c.id} to={`/c/${c.id}`} className="card p-4 flex items-center gap-3 hover:-translate-y-0.5 transition-transform">
                <CharmAvatar charm={c} size={44} />
                <div className="min-w-0">
                  <div className="font-semibold text-sm">{c.name}</div>
                  <div className="font-mono text-xs text-[var(--color-ink-soft)]">${c.ticker}</div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* activity */}
      <h2 className="font-serif text-2xl mb-3">Activity</h2>
      {activity.length === 0 ? (
        <div className="text-[var(--color-ink-soft)] text-sm">No activity yet.</div>
      ) : (
        <div className="card divide-y divide-[rgba(20,32,59,.07)] overflow-hidden">
          {activity.slice(0, 20).map((a, i) => {
            const charm = getCharm(a.id)
            if (!charm) return null
            const verb = a.type === 'buy' ? 'Bought' : a.type === 'sell' ? 'Sold' : 'Launched'
            const color = a.type === 'buy' ? 'text-[var(--color-up)]' : a.type === 'sell' ? 'text-[var(--color-down)]' : ''
            return (
              <div key={i} className="flex items-center gap-3 p-3 text-sm">
                <CharmAvatar charm={charm} size={32} />
                <div className="flex-1">
                  <span className={`font-semibold ${color}`}>{verb}</span> {charm.name}
                  {a.units != null && <span className="font-mono text-[var(--color-ink-soft)]"> · {num(a.units)} {charm.ticker}</span>}
                </div>
                {a.usd != null && <span className="font-mono">{usd(a.usd)}</span>}
                <span className="text-xs text-[var(--color-ink-soft)] w-8 text-right">{timeAgo(a.ts)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, big }) {
  return (
    <div>
      <div className={`font-mono font-semibold ${big ? 'text-2xl' : 'text-lg'}`}>{value}</div>
      <div className="text-xs text-[var(--color-ink-soft)]">{label}</div>
    </div>
  )
}
