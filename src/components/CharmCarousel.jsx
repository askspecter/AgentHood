import { useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import CharmAvatar, { toneFor } from './CharmAvatar'
import { Verified, XLogo } from './icons'
import { usd, num, pct } from '../lib/format'

/**
 * A swipeable / draggable card rail — like the Charms feed.
 * Touch scroll + scroll-snap on mobile, click-drag on desktop, and dot
 * pagination that tracks whichever card is nearest the centre.
 */
export default function CharmCarousel({ charms, prices }) {
  const nav = useNavigate()
  const railRef = useRef(null)
  const [active, setActive] = useState(0)
  const drag = useRef({ down: false, moved: false, startX: 0, startLeft: 0 })
  const ticking = useRef(false)

  const cards = () => [...(railRef.current?.querySelectorAll('[data-card]') ?? [])]

  const onScroll = useCallback(() => {
    if (ticking.current) return
    ticking.current = true
    requestAnimationFrame(() => {
      const el = railRef.current
      if (el) {
        const center = el.scrollLeft + el.clientWidth / 2
        let best = 0, bd = Infinity
        cards().forEach((c, i) => {
          const cc = c.offsetLeft + c.offsetWidth / 2
          const d = Math.abs(cc - center)
          if (d < bd) { bd = d; best = i }
        })
        setActive(best)
      }
      ticking.current = false
    })
  }, [])

  const go = (i) => {
    const el = railRef.current, c = cards()[i]
    if (!el || !c) return
    el.scrollTo({ left: c.offsetLeft - (el.clientWidth - c.offsetWidth) / 2, behavior: 'smooth' })
  }

  // click-drag to scroll (desktop mice); touch uses native scrolling
  const onDown = (e) => {
    if (e.pointerType !== 'mouse') return
    const el = railRef.current
    drag.current = { down: true, moved: false, startX: e.clientX, startLeft: el.scrollLeft }
  }
  const onMove = (e) => {
    if (!drag.current.down) return
    const dx = e.clientX - drag.current.startX
    if (Math.abs(dx) > 5) drag.current.moved = true
    railRef.current.scrollLeft = drag.current.startLeft - dx
  }
  const onUp = () => { drag.current.down = false }
  const open = (id) => (e) => { if (drag.current.moved) { e.preventDefault(); e.stopPropagation(); return } nav(`/c/${id}`) }

  return (
    <div>
      <div
        ref={railRef}
        onScroll={onScroll}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-1
                   -mx-4 px-4 md:mx-0 md:px-0 cursor-grab active:cursor-grabbing"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {charms.map((c) => (
          <Card key={c.id} charm={c} price={prices[c.id]} onOpen={open(c.id)}
            onTrade={(e) => { e.stopPropagation(); nav(`/c/${c.id}`) }} />
        ))}
      </div>

      {/* pagination dots */}
      <div className="flex justify-center items-center gap-2 mt-5">
        {charms.map((_, i) => (
          <button key={i} onClick={() => go(i)} aria-label={`Go to card ${i + 1}`}
            className="h-2 rounded-full transition-all duration-300"
            style={{ width: i === active ? 24 : 8, background: i === active ? 'var(--holo-line)' : 'rgba(255,255,255,0.2)' }} />
        ))}
      </div>
    </div>
  )
}

function Card({ charm, price, onOpen, onTrade }) {
  const up = charm.change24 >= 0
  const [c1, c2] = toneFor(charm)
  return (
    <article
      data-card
      onClick={onOpen}
      className="snap-center shrink-0 w-[82%] sm:w-[340px] rounded-[26px] overflow-hidden card-hover cursor-pointer select-none"
      style={{ border: '1px solid var(--color-line)', background: 'rgba(255,255,255,0.02)' }}
    >
      {/* hero — tone-tinted, glossy avatar floating */}
      <div className="relative h-44 grid place-items-center overflow-hidden"
        style={{ background: `radial-gradient(85% 85% at 50% 8%, ${c1}59, transparent 60%), linear-gradient(180deg, ${c2}2e, rgba(9,8,16,0.5))` }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(60% 60% at 50% 42%, rgba(255,255,255,0.10), transparent 70%)' }} />
        <div className="floaty"><CharmAvatar charm={charm} size={112} ring /></div>
        {charm.change24 != null && <span className={`absolute top-3.5 right-3.5 chip ${up ? 'chip-up' : 'chip-down'}`}>{pct(charm.change24)}</span>}
      </div>

      {/* body */}
      <div className="p-5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-semibold text-lg truncate">{charm.name}</span>
          <Verified size={14} />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[var(--color-ink-faint)] mt-0.5">
          <XLogo size={10} /><span className="truncate">{charm.creator}</span>
        </div>

        <div className="flex items-center gap-5 mt-3.5">
          <div>
            <div className="font-mono num text-sm">{usd(price ?? charm.price)}</div>
            <div className="eyebrow mt-0.5">Price</div>
          </div>
          <div>
            <div className="font-mono num text-sm">{usd(charm.mcap)}</div>
            <div className="eyebrow mt-0.5">Market cap</div>
          </div>
          <div>
            <div className="font-mono num text-sm">{num(charm.holders)}</div>
            <div className="eyebrow mt-0.5">Holders</div>
          </div>
        </div>

        <p className="text-sm text-[var(--color-ink-soft)] mt-4 truncate">{charm.tagline}</p>

        <button onClick={onTrade} className="btn btn-holo w-full mt-5 !py-2.5">Trade ${charm.ticker}</button>
      </div>
    </article>
  )
}
