import { Link, useParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import CharmAvatar from '../components/CharmAvatar'
import PriceChart from '../components/PriceChart'
import TradePanel from '../components/TradePanel'
import { usd, num, pct } from '../lib/format'
import { Verified } from '../components/icons'

export default function CharmDetail() {
  const { id } = useParams()
  const { getCharm, prices, watch, toggleWatch } = useStore()
  const charm = getCharm(id)

  if (!charm) return <div className="text-center py-20 text-[var(--color-ink-soft)]">Character not found. <Link className="underline" to="/">Back to explore</Link></div>

  const price = prices[charm.id] ?? charm.price
  const up = charm.change24 >= 0
  const watched = watch.includes(charm.id)

  return (
    <div className="max-w-5xl mx-auto">
      <Link to="/" className="text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">Back</Link>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6 mt-4">
        <div className="space-y-6">
          {/* header */}
          <div className="card card-glow p-6"
            style={{ background: `linear-gradient(180deg, hsl(${charm.hue} 50% 22% / .35), rgba(255,255,255,.02))` }}>
            <div className="flex items-start gap-4">
              <CharmAvatar charm={charm} size={72} ring />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-serif text-3xl">{charm.name}</h1>
                  <Verified size={16} />
                  <span className="font-mono text-sm text-[var(--color-ink-soft)]">${charm.ticker}</span>
                </div>
                <p className="text-[var(--color-ink-soft)] mt-1">{charm.tagline}</p>
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {charm.vibe.map((v) => <span key={v} className="chip">{v}</span>)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-5">
              <Link to={`/chat/${charm.id}`} className="btn btn-primary text-sm flex-1 sm:flex-none">Chat with {charm.name}</Link>
              <button onClick={() => toggleWatch(charm.id)} className={`btn text-sm ${watched ? 'btn-accent' : 'btn-ghost'}`}>
                {watched ? 'Watching' : 'Watch'}
              </button>
            </div>
          </div>

          {/* price + chart */}
          <div className="card p-6">
            <div className="flex items-end justify-between mb-4">
              <div>
                <div className="eyebrow mb-1">Price</div>
                <div className="font-mono text-3xl font-semibold">{usd(price)}</div>
              </div>
              <div className={`text-right ${up ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}`}>
                <div className="font-semibold">{pct(charm.change24)}</div>
                <div className="text-xs text-[var(--color-ink-soft)]">24h</div>
              </div>
            </div>
            <PriceChart seed={charm.history} live={price} up={up} />
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t hairline text-center">
              <Stat label="Market cap" value={usd(charm.mcap)} />
              <Stat label="Holders" value={num(charm.holders)} />
              <Stat label="Supply" value={num(charm.supply)} />
            </div>
          </div>

          {/* lore */}
          <div className="card p-6">
            <div className="eyebrow mb-1">The story</div>
            <h2 className="font-serif text-2xl mb-2">Lore</h2>
            <p className="text-[var(--color-ink-soft)] leading-relaxed">{charm.lore}</p>
            <div className="mt-4 flex items-center gap-2 text-sm text-[var(--color-ink-soft)]">
              <span>Created by</span>
              <span className="chip-accent chip">{charm.creator}</span>
              <span className="opacity-40">/</span>
              <span>{num(charm.followers)} followers</span>
            </div>
          </div>
        </div>

        <div>
          <TradePanel charm={charm} />
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="font-mono font-semibold">{value}</div>
      <div className="text-xs text-[var(--color-ink-soft)]">{label}</div>
    </div>
  )
}
