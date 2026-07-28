import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import CharmAvatar from './CharmAvatar'
import Sparkline from './Sparkline'
import { usd, num, pct } from '../lib/format'

export default function Hero({ charms, stats, prices }) {
  const nav = useNavigate()
  const mover = [...charms].sort((a, b) => b.change24 - a.change24)[0]
  const cluster = charms.slice(0, 4)
  const sceneRef = useRef(null)
  const orbRef = useRef(null)

  function onMove(e) {
    const el = sceneRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    el.style.setProperty('--px', `${x * 26}px`)
    el.style.setProperty('--py', `${y * 26}px`)
    if (orbRef.current) orbRef.current.style.transform = `rotateY(${x * 16}deg) rotateX(${-y * 16}deg)`
  }
  function onLeave() {
    sceneRef.current?.style.setProperty('--px', '0px')
    sceneRef.current?.style.setProperty('--py', '0px')
    if (orbRef.current) orbRef.current.style.transform = 'rotateY(0) rotateX(0)'
  }

  return (
    <section
      ref={sceneRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="tilt-scene relative grid lg:grid-cols-[1.05fr_0.95fr] gap-8 lg:gap-6 items-center pt-4 lg:pt-10 pb-14"
    >
      {/* copy */}
      <div className="relative z-10">
        <div className="fade-up flex items-center gap-3 mb-7">
          <span className="chip chip-brand">Live market</span>
          <span className="eyebrow flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[var(--color-up)] blink" /> {num(stats.count)} trading now</span>
        </div>

        <h1 className="fade-up fade-up-1 display text-[13.5vw] sm:text-6xl lg:text-[5rem]">
          Own the <span className="iris">characters</span><br className="hidden sm:block" /> the internet falls for.
        </h1>

        <p className="fade-up fade-up-2 mt-6 text-lg leading-relaxed text-[var(--color-ink-soft)] max-w-md">
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

      {/* stage */}
      <div className="relative min-h-[360px] lg:min-h-[520px] grid place-items-center">
        {/* ambient glow */}
        <div className="absolute w-[420px] h-[420px] rounded-full blur-3xl opacity-60 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(139,123,255,.55), rgba(56,214,238,.12) 55%, transparent 70%)', transform: 'translate(var(--px,0), var(--py,0))' }} />
        {/* orbit rings */}
        <div className="absolute spin-slow rounded-full border border-white/8 pointer-events-none" style={{ width: 360, height: 360 }} />
        <div className="absolute rounded-full border border-white/5 pointer-events-none" style={{ width: 460, height: 460 }} />

        {/* main glass sphere */}
        {mover && (
          <div ref={orbRef} className="tilt floaty relative" style={{ transformStyle: 'preserve-3d' }}>
            <CharmAvatar charm={mover} size={220} ring />
            {/* floating price tag */}
            <div className="glass absolute -right-6 -bottom-2 px-4 py-3 rounded-2xl" style={{ transform: 'translateZ(40px)' }}>
              <div className="eyebrow mb-0.5">${mover.ticker}</div>
              <div className="font-mono num text-lg leading-none">{usd(prices?.[mover.id] ?? mover.price)}</div>
              <div className={`text-xs font-mono num mt-0.5 ${mover.change24 >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}`}>{pct(mover.change24)}</div>
            </div>
            <div className="glass absolute -left-8 top-4 px-3 py-2 rounded-xl flex items-center gap-2" style={{ transform: 'translateZ(64px)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-up)] blink" />
              <span className="text-xs font-medium">{mover.name}</span>
            </div>
          </div>
        )}

        {/* satellite orbs */}
        {cluster.map((c, i) => (
          <div key={c.id} className="absolute floaty pointer-events-none" style={{
            top: ['8%', '74%', '18%', '68%'][i],
            left: ['6%', '12%', '86%', '82%'][i],
            animationDelay: `${i * 0.9}s`,
            transform: 'translate(calc(var(--px,0) * ' + (0.4 + i * 0.2) + '), calc(var(--py,0) * ' + (0.4 + i * 0.2) + '))',
          }}>
            <CharmAvatar charm={c} size={[46, 38, 54, 40][i]} ring />
          </div>
        ))}
      </div>
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
