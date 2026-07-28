import { useState } from 'react'
import CharmAvatar from './CharmAvatar'
import Sparkline from './Sparkline'
import { CHARMS } from '../data/charms'
import { Verified, Back } from './icons'

const A = CHARMS[2] // trade demo
const L = CHARMS[7] // mint demo
const C = CHARMS[4] // chat demo

const SLIDES = [
  { key: 'trade', hue: 215, title: 'Trade', body: 'Spot the next icon of the internet early, then trade its coin.' },
  { key: 'mint', hue: 48, title: 'Mint', body: 'Dream up a character, give it a face and a soul, and mint its coin.' },
  { key: 'chat', hue: 290, title: 'Chat', body: 'Talk to the character behind the coin. It remembers you.' },
  { key: 'lore', hue: 150, title: 'Shape the lore', body: 'Create and remix with the community until it becomes canon.' },
]

export default function IntroModal({ open, onClose }) {
  const [i, setI] = useState(0)
  if (!open) return null
  const s = SLIDES[i]
  const last = i === SLIDES.length - 1

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-t-[2rem] overflow-hidden flex flex-col border-t border-x border-white/12"
        style={{
          height: '82vh',
          background: `
            radial-gradient(120% 70% at 50% -10%, hsl(${s.hue} 55% 24% / .75), transparent 60%),
            linear-gradient(180deg, #0a0c14 0%, #05060a 100%)`,
        }}
      >
        {/* dotted texture */}
        <div className="absolute inset-0 opacity-30 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,.18) 1px, transparent 1.4px)',
          backgroundSize: '24px 24px',
        }} />

        {/* drag handle */}
        <div className="relative z-10 flex justify-center pt-3">
          <div className="w-10 h-1.5 rounded-full bg-white/30" />
        </div>

        {/* mock visual */}
        <div className="relative z-10 flex-1 grid place-items-center px-8">
          {s.key === 'trade' && <TradeMock />}
          {s.key === 'mint' && <MintMock />}
          {s.key === 'chat' && <ChatMock />}
          {s.key === 'lore' && <LoreMock />}
        </div>

        {/* copy */}
        <div className="relative z-10 px-8 text-center text-white">
          <h2 className="font-serif text-5xl mb-3" style={{ textShadow: `0 0 40px hsl(${s.hue} 70% 60% / .55)` }}>{s.title}</h2>
          <p className="text-white/75 text-lg leading-snug max-w-sm mx-auto">{s.body}</p>

          {/* dots */}
          <div className="flex justify-center gap-1.5 my-6">
            {SLIDES.map((_, k) => (
              <button key={k} onClick={() => setI(k)} className="h-1 rounded-full transition-all"
                style={{ width: k === i ? 24 : 8, background: k === i ? 'var(--color-accent)' : 'rgba(255,255,255,.3)' }} />
            ))}
          </div>

          <button
            onClick={() => (last ? onClose() : setI(i + 1))}
            className="btn btn-primary w-full mb-6 !py-3.5 text-base"
          >
            {last ? 'Start' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TradeMock() {
  return (
    <div className="w-full max-w-[280px] rounded-2xl p-4 border border-white/12 bg-white/4">
      <div className="flex items-center gap-2 mb-2">
        <Back size={15} stroke="var(--color-ink-soft)" />
        <CharmAvatar charm={A} size={24} />
        <span className="text-white font-semibold text-sm">{A.name}</span>
        <Verified size={13} />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-white font-mono font-bold text-2xl">$6.8M</span>
        <span className="text-white/50 text-xs font-semibold">MCAP</span>
      </div>
      <div className="text-[var(--color-up)] text-sm font-semibold mb-2">+1.58%</div>
      <Sparkline data={A.history} up width={248} height={70} strokeWidth={2.5} />
    </div>
  )
}

function MintMock() {
  return (
    <div className="w-full max-w-[250px] rounded-3xl p-6 flex flex-col items-center text-center border border-white/15 bg-white/4">
      <CharmAvatar charm={L} size={78} ring />
      <div className="font-serif text-2xl text-white mt-4">{L.name}</div>
      <div className="font-mono font-bold text-white/80 mt-0.5">${L.ticker}</div>
      <div className="flex gap-1.5 mt-3">
        {['cozy', 'fast', 'hype'].map((t) => (
          <span key={t} className="chip text-[10px]">{t}</span>
        ))}
      </div>
    </div>
  )
}

function ChatMock() {
  return (
    <div className="w-full max-w-[300px]">
      <div className="rounded-2xl p-3.5 border border-white/12 bg-white/4">
        <div className="flex items-center justify-between mb-3">
          <Back size={14} stroke="var(--color-ink-soft)" />
          <div className="flex items-center gap-1.5"><CharmAvatar charm={C} size={20} /><span className="font-semibold text-sm text-white">{C.name}</span></div>
          <span className="text-[10px] font-semibold text-[var(--color-accent-hi)] border border-[rgba(217,165,82,.4)] rounded-full px-2 py-0.5">Trade</span>
        </div>
        <div className="flex justify-start mb-2">
          <div className="bg-white/8 text-white/90 text-xs rounded-2xl rounded-bl-sm px-3 py-2 max-w-[85%]">
            gm. {C.name} here. I would guard this conversation with my life.
          </div>
        </div>
        <div className="flex justify-end">
          <div className="text-[#14110a] text-xs rounded-2xl rounded-br-sm px-3 py-2 font-medium"
            style={{ background: 'linear-gradient(180deg,#f0c37b,#cfa156)' }}>
            good boy
          </div>
        </div>
      </div>
    </div>
  )
}

function LoreMock() {
  const tiles = [CHARMS[5], CHARMS[3], CHARMS[6], CHARMS[0]]
  return (
    <div className="relative w-full max-w-[300px]">
      <div className="rounded-2xl p-3.5 border border-white/12 bg-white/4">
        <div className="font-serif text-lg mb-2.5 text-white">Recent creations</div>
        <div className="grid grid-cols-2 gap-2">
          {tiles.map((c) => (
            <div key={c.id} className="h-20 rounded-xl grid place-items-center font-serif text-3xl text-white/90"
              style={{ background: `radial-gradient(120% 120% at 30% 22%, hsl(${c.hue} 55% 42%), hsl(${(c.hue + 50) % 360} 60% 20%))` }}>
              {c.name[0]}
            </div>
          ))}
        </div>
      </div>
      <span className="absolute -top-3 -right-2 font-mono font-bold text-sm rounded-full px-2.5 py-1 border border-[rgba(217,165,82,.5)] text-[var(--color-accent-hi)]"
        style={{ background: '#0a0c14' }}>+50</span>
      <span className="absolute -bottom-4 right-2 rounded-full px-3.5 py-1.5 text-sm font-semibold text-[#14110a]"
        style={{ background: 'linear-gradient(180deg,#f0c37b,#cfa156)' }}>Remix</span>
    </div>
  )
}
