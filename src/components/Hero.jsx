import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import HoloSphere from './HoloSphere'
import { num } from '../lib/format'

export default function Hero({ stats }) {
  const nav = useNavigate()
  const sceneRef = useRef(null)

  function onMove(e) {
    const el = sceneRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    el.style.setProperty('--px', `${x * 30}px`)
    el.style.setProperty('--py', `${y * 30}px`)
  }
  function onLeave() {
    sceneRef.current?.style.setProperty('--px', '0px')
    sceneRef.current?.style.setProperty('--py', '0px')
  }

  return (
    <section
      ref={sceneRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="tilt-scene relative grid grid-cols-1 lg:grid-cols-[1.06fr_0.94fr] gap-8 lg:gap-6 items-center min-h-[68vh] lg:min-h-[82vh] pt-2 pb-10"
    >
      {/* ── copy ── */}
      <div className="relative z-10">
        <div className="fade-up mb-8">
          <span className="holo-border inline-flex items-center gap-2 px-3.5 py-1.5">
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex h-full w-full rounded-full opacity-70 blink"
                style={{ background: 'var(--holo-line)' }} />
              <span className="relative inline-flex rounded-full w-2 h-2" style={{ background: '#c9b8ff' }} />
            </span>
            <span className="font-mono text-[11px] tracking-[0.16em] uppercase text-[var(--color-ink)]">
              Live market
            </span>
          </span>
        </div>

        <h1 className="holo-head fade-up fade-up-1 font-bold tracking-[-0.035em] leading-[0.95]
                       text-[13.5vw] sm:text-[8.5vw] lg:text-[5.2rem]">
          <span className="holo-text block">
            Own the<br />characters the<br />internet falls for.
          </span>
        </h1>

        <p className="fade-up fade-up-2 mt-7 text-lg leading-relaxed text-[var(--color-ink-soft)] max-w-sm">
          Every character has a personality, a story, and a coin.
        </p>

        <div className="fade-up fade-up-3 mt-9 flex flex-wrap items-center gap-3">
          <button
            onClick={() => document.getElementById('index')?.scrollIntoView({ behavior: 'smooth' })}
            className="btn btn-holo !px-6 !py-3.5 !text-[0.95rem]">
            Browse the market
          </button>
          <button onClick={() => nav('/launch')} className="btn btn-secondary !px-6 !py-3.5">
            Mint a character
          </button>
        </div>

        {stats?.count != null && (
          <div className="fade-up fade-up-4 mt-8 flex items-center gap-2 text-[var(--color-ink-faint)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-up)] blink" />
            <span className="font-mono text-xs tracking-[0.14em] uppercase">
              {num(stats.count)} characters trading now
            </span>
          </div>
        )}
      </div>

      {/* ── stage ── */}
      <div className="relative min-h-[300px] lg:min-h-[560px] grid place-items-center"
        style={{ transform: 'translate(calc(var(--px,0px) * 0.35), calc(var(--py,0px) * 0.35))' }}>
        <div className="fade-up fade-up-2">
          <HoloSphere size={300} />
        </div>
      </div>
    </section>
  )
}
