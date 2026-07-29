import { Link, useParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import CharmAvatar from '../components/CharmAvatar'
import PriceChart from '../components/PriceChart'
import TradePanel from '../components/TradePanel'
import CreatorFees from '../components/CreatorFees'
import { usd, num, pct } from '../lib/format'
import { Verified, XLogo, Back } from '../components/icons'

/**
 * Agent page — a real pons coin, dressed as a character. Chat with it, and trade
 * it right here: the pons-style swap sits directly under the header.
 */
export default function CharmDetail() {
  const { id } = useParams()
  const { getAgent, prices, explorer, agentsLoading } = useStore()
  const charm = getAgent(id)

  if (!charm) {
    return (
      <div className="text-center py-20 text-[var(--color-ink-soft)]">
        {agentsLoading ? 'Loading agent…' : <>Agent not found. <Link className="underline" to="/">Back to Discover</Link></>}
      </div>
    )
  }

  const price = prices[charm.id] ?? charm.price
  const grad = charm.graduated
  const addr = charm.token

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
        <Back size={15} /> Discover
      </Link>

      {/* header */}
      <div className="card p-6">
        <div className="flex items-start gap-4">
          <CharmAvatar charm={charm} size={68} ring />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-serif text-3xl">{charm.name}</h1>
              <Verified size={16} />
              <span className="font-mono text-sm text-[var(--color-ink-faint)]">${charm.ticker}</span>
              {grad === true && <span className="chip chip-up">Graduated</span>}
            </div>
            <div className="flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)] mt-1">
              <XLogo size={10} /><span>{charm.creator}</span>
              {addr && <><span className="opacity-40">·</span>
              <span className="font-mono text-xs">{addr.slice(0, 6)}…{addr.slice(-4)}</span></>}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {charm.vibe.map((v) => <span key={v} className="chip">{v}</span>)}
            </div>
          </div>
        </div>
        <div className="mt-5">
          <Link to={`/chat/${charm.id}`} className="btn btn-primary w-full">Chat with {charm.name}</Link>
        </div>
      </div>

      {/* creator fees — only shown to the wallet that launched this coin */}
      {addr && <CreatorFees token={addr} symbol={charm.ticker} />}

      {/* about */}
      <div className="card p-6">
        <div className="eyebrow mb-2">About</div>
        <p className="text-[var(--color-ink)] leading-relaxed">{charm.lore}</p>
      </div>

      {/* trade — pons-style */}
      <TradePanel token={addr} symbol={charm.ticker} name={charm.name} logo={charm.logo} />

      {/* price + chart */}
      <div className="card p-6">
        <div className="flex items-end justify-between mb-5">
          <div>
            <div className="eyebrow mb-1">Price</div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="font-mono num text-3xl font-semibold">{price ? usd(price) : '—'}</div>
              {charm.change24 != null && (
                <span className={`chip !text-sm ${charm.change24 >= 0 ? 'chip-up' : 'chip-down'}`}>{pct(charm.change24)} · 24h</span>
              )}
            </div>
          </div>
          {typeof charm.graduationProgress === 'number' && grad !== true && (
            <span className="chip !text-sm">{Math.round(charm.graduationProgress * 100)}% to graduation</span>
          )}
        </div>
        <PriceChart seed={charm.history} live={price} up={charm.change24 == null ? true : charm.change24 >= 0} />
        <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t hairline">
          <Stat label="Market cap" value={charm.mcap ? usd(charm.mcap) : '—'} />
          <Stat label="Holders" value={charm.holders != null ? num(charm.holders) : '—'} />
          <Stat label="Supply" value={num(charm.supply)} />
        </div>
        {explorer && addr && (
          <a href={`${explorer}/token/${addr}`} target="_blank" rel="noopener noreferrer"
            className="inline-block mt-4 text-xs text-[var(--color-accent)] hover:underline">View on explorer ↗</a>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="font-mono num font-semibold">{value}</div>
      <div className="text-xs text-[var(--color-ink-soft)] mt-0.5">{label}</div>
    </div>
  )
}
