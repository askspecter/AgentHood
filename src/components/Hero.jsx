import { useNavigate } from 'react-router-dom'
import CharmAvatar from './CharmAvatar'
import Sparkline from './Sparkline'
import { usd, num, pct } from '../lib/format'

export default function Hero({ charms, stats, prices }) {
  const nav = useNavigate()
  const mover = [...charms].sort((a, b) => b.change24 - a.change24)[0]

  return (
    <section className="grid lg:grid-cols-[1.15fr_0.85fr] gap-10 lg:gap-16 items-center pt-6 lg:pt-14 pb-14 border-b hairline">
      {/* copy */}
      <div>
        <div className="fade-up flex items-center gap-3 mb-7">
          <span className="eyebrow">A market for AI characters</span>
          <span className="w-8 border-t hairline" />
          <span className="eyebrow flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-up)] blink" /> Live
          </span>
        </div>

        <h1 className="fade-up fade-up-1 display text-[15vw] sm:text-7xl lg:text-[5.4rem]">
          Own the characters<br className="hidden sm:block" /> the internet falls for.
        </h1>

        <p className="fade-up fade-up-2 mt-7 text-lg leading-relaxed text-[var(--color-ink-soft)] max-w-md">
          Every character has a personality, a story, and a coin. Back the ones you believe in,
          talk to them, or mint your own.
        </p>

        <div className="fade-up fade-up-3 mt-9 flex flex-wrap items-center gap-3">
          <button onClick={() => document.getElementById('index')?.scrollIntoView({ behavior: 'smooth' })} className="btn btn-primary !px-6 !py-3">
            Browse the market
          </button>
          <button onClick={() => nav('/create')} className="btn btn-secondary !px-6 !py-3">Mint a character</button>
        </div>

        <div className="fade-up fade-up-4 mt-11 flex items-stretch">
          <Fig label="Market cap" value={usd(stats.mcap)} />
          <span className="w-px bg-[var(--color-line)] mx-6" />
          <Fig label="Holders" value={num(stats.holders)} />
          <span className="w-px bg-[var(--color-line)] mx-6" />
          <Fig label="Characters" value={num(stats.count)} />
        </div>
      </div>

      {/* terminal panel */}
      {mover && (
        <div className="fade-up fade-up-2 panel overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b hairline">
            <span className="eyebrow">Top mover · 24h</span>
            <span className="eyebrow">${mover.ticker}</span>
          </div>
          <button onClick={() => nav(`/c/${mover.id}`)} className="w-full text-left px-5 pt-5 pb-4 hover:bg-[var(--color-paper-2)] transition">
            <div className="flex items-center gap-3">
              <CharmAvatar charm={mover} size={44} />
              <div className="flex-1">
                <div className="font-medium">{mover.name}</div>
                <div className="text-xs text-[var(--color-ink-faint)]">by {mover.creator}</div>
              </div>
              <span className={`chip ${mover.change24 >= 0 ? 'chip-up' : 'chip-down'}`}>{pct(mover.change24)}</span>
            </div>
            <div className="mt-5 flex items-end justify-between">
              <div>
                <div className="eyebrow mb-1">Price</div>
                <div className="font-mono num text-3xl">{usd(prices?.[mover.id] ?? mover.price)}</div>
              </div>
              <Sparkline data={mover.history} up={mover.change24 >= 0} width={150} height={44} />
            </div>
          </button>
          <div className="grid grid-cols-2 divide-x divide-[var(--color-line)] border-t hairline">
            <Cell label="Market cap" value={usd(mover.mcap)} />
            <Cell label="Holders" value={num(mover.holders)} />
          </div>
        </div>
      )}
    </section>
  )
}

function Fig({ label, value }) {
  return (
    <div>
      <div className="font-mono num text-xl lg:text-2xl">{value}</div>
      <div className="eyebrow mt-1.5">{label}</div>
    </div>
  )
}
function Cell({ label, value }) {
  return (
    <div className="px-5 py-3.5">
      <div className="eyebrow mb-1">{label}</div>
      <div className="font-mono num">{value}</div>
    </div>
  )
}
