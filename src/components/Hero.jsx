import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import CharmAvatar from './CharmAvatar'
import { useCountUp } from '../lib/hooks'
import { num, usd } from '../lib/format'

export default function Hero({ charms, stats }) {
  const nav = useNavigate()
  const ref = useRef(null)
  const orbs = charms.slice(0, 5)

  function onMove(e) {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    ref.current.style.setProperty('--mx', `${e.clientX - r.left}px`)
    ref.current.style.setProperty('--my', `${e.clientY - r.top}px`)
  }

  return (
    <section
      ref={ref}
      onMouseMove={onMove}
      className="spotlight relative overflow-hidden rounded-3xl border hairline mb-10"
      style={{ background: 'linear-gradient(180deg,#fff, #fbfbfd)' }}
    >
      {/* aurora */}
      <div className="aurora">
        <span style={{ width: 380, height: 380, top: -120, left: -60, background: '#c7d2fe' }} />
        <span style={{ width: 320, height: 320, top: -80, right: -40, background: '#fbcfe8', animationDelay: '-6s' }} />
        <span style={{ width: 300, height: 300, bottom: -140, left: '35%', background: '#bfdbfe', animationDelay: '-11s' }} />
      </div>

      {/* floating character orbs (desktop) */}
      <div className="hidden lg:block absolute inset-0 pointer-events-none">
        {orbs.map((c, i) => (
          <div key={c.id} className="absolute orb-float"
            style={{
              top: ['14%', '58%', '22%', '68%', '40%'][i],
              left: ['76%', '84%', '90%', '72%', '94%'][i],
              animationDelay: `${i * 0.9}s`,
              opacity: 0.9,
            }}>
            <CharmAvatar charm={c} size={[52, 40, 64, 44, 34][i]} ring />
          </div>
        ))}
      </div>

      <div className="relative px-6 sm:px-10 lg:px-14 py-14 lg:py-20 max-w-3xl">
        <div className="fade-up flex items-center gap-2.5 mb-6">
          <span className="chip chip-brand">Live market</span>
          <span className="flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)]">
            <span className="w-2 h-2 rounded-full bg-[var(--color-up)] live-dot" />
            {num(stats.count)} characters trading now
          </span>
        </div>

        <h1 className="fade-up fade-up-1 font-serif text-[13vw] sm:text-6xl lg:text-7xl leading-[0.98] tracking-[-0.02em]">
          Own the <span className="grad-text">characters</span> the internet falls for.
        </h1>

        <p className="fade-up fade-up-2 mt-6 text-lg text-[var(--color-ink-soft)] max-w-xl">
          Every character has a personality, a story, and a coin. Trade the ones you believe in,
          chat with them, or mint your own — before the timeline catches on.
        </p>

        <div className="fade-up fade-up-3 mt-8 flex flex-wrap items-center gap-3">
          <button onClick={() => document.getElementById('index')?.scrollIntoView({ behavior: 'smooth' })} className="btn btn-primary !px-6 !py-3">
            Explore the market
          </button>
          <button onClick={() => nav('/create')} className="btn btn-secondary !px-6 !py-3">Mint a character</button>
        </div>

        <div className="fade-up fade-up-4 mt-12 grid grid-cols-3 gap-6 max-w-lg">
          <Counter label="Market cap" value={stats.mcap} money />
          <Counter label="Holders" value={stats.holders} />
          <Counter label="Characters" value={stats.count} suffix="+" />
        </div>
      </div>
    </section>
  )
}

function Counter({ label, value, money, suffix = '' }) {
  const n = useCountUp(value)
  return (
    <div>
      <div className="font-mono num text-2xl lg:text-3xl font-semibold">
        {money ? usd(n) : num(n) + suffix}
      </div>
      <div className="eyebrow mt-1">{label}</div>
    </div>
  )
}
