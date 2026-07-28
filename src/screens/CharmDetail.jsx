import { Link, useParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import CharmAvatar from '../components/CharmAvatar'
import PriceChart from '../components/PriceChart'
import TradePanel from '../components/TradePanel'
import { usd, num, pct } from '../lib/format'
import { Verified, XLogo, Back } from '../components/icons'

export default function CharmDetail() {
  const { id } = useParams()
  const { getCharm, prices, watch, toggleWatch } = useStore()
  const charm = getCharm(id)

  if (!charm) return <div className="text-center py-20 text-[var(--color-ink-soft)]">Character not found. <Link className="underline" to="/">Back to discover</Link></div>

  const price = prices[charm.id] ?? charm.price
  const up = charm.change24 >= 0
  const watched = watch.includes(charm.id)

  return (
    <div>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] mb-5">
        <Back size={15} /> Discover
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-4">
          {/* header */}
          <div className="card p-6">
            <div className="flex items-start gap-4">
              <CharmAvatar charm={charm} size={68} ring />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-serif text-3xl">{charm.name}</h1>
                  <Verified size={16} />
                  <span className="font-mono text-sm text-[var(--color-ink-faint)]">${charm.ticker}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)] mt-1">
                  <XLogo size={10} /><span>{charm.creator}</span>
                  <span className="opacity-40">·</span>
                  <span>{num(charm.followers)} followers</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {charm.vibe.map((v) => <span key={v} className="chip">{v}</span>)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-5">
              <Link to={`/chat/${charm.id}`} className="btn btn-primary flex-1 sm:flex-none">Chat with {charm.name}</Link>
              <button onClick={() => toggleWatch(charm.id)} className={`btn ${watched ? 'btn-accent' : 'btn-secondary'}`}>{watched ? 'Watching' : 'Watch'}</button>
            </div>
          </div>

          {/* price + chart */}
          <div className="card p-6">
            <div className="flex items-end justify-between mb-5">
              <div>
                <div className="eyebrow mb-1">Price</div>
                <div className="font-mono num text-3xl font-semibold">{usd(price)}</div>
              </div>
              <span className={`chip ${up ? 'chip-up' : 'chip-down'} !text-sm`}>{pct(charm.change24)} · 24h</span>
            </div>
            <PriceChart seed={charm.history} live={price} up={up} />
            <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t hairline">
              <Stat label="Market cap" value={usd(charm.mcap)} />
              <Stat label="Holders" value={num(charm.holders)} />
              <Stat label="Supply" value={num(charm.supply)} />
            </div>
          </div>

          {/* lore */}
          <div className="card p-6">
            <div className="eyebrow mb-2">Story</div>
            <p className="text-[var(--color-ink)] leading-relaxed">{charm.lore}</p>
          </div>
        </div>

        <div><TradePanel charm={charm} /></div>
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
