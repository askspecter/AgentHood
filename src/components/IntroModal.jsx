import { useState } from 'react'
import CharmAvatar from './CharmAvatar'
import Sparkline from './Sparkline'
import { CHARMS } from '../data/charms'
import { Verified, Mentions, ArrowStat, Back } from './icons'

const A = CHARMS[2] // trade demo
const L = CHARMS[7] // launch demo
const C = CHARMS[4] // chat demo

const SLIDES = [
  { key: 'trade', dark: true, title: 'Trade', body: 'Spot the next internet icon early — then trade its coin.' },
  { key: 'launch', dark: false, title: 'Launch', body: 'Dream up a character, give it a face and a soul, and mint its coin.' },
  { key: 'chat', dark: false, title: 'Chat', body: 'Talk to the character behind the coin. It remembers you.' },
  { key: 'lore', dark: false, title: 'Shape the lore', body: 'Create and remix with the community until it goes viral.' },
]

export default function IntroModal({ open, onClose }) {
  const [i, setI] = useState(0)
  if (!open) return null
  const s = SLIDES[i]
  const last = i === SLIDES.length - 1

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-t-[2rem] overflow-hidden flex flex-col"
        style={{ height: '82vh', ...(s.dark
          ? { background: '#0c2a63' }
          : { background: 'linear-gradient(180deg,#2c7cf5 0%,#6aa6f9 45%,#bcd8fb 78%,#eef5ff 100%)' }) }}
      >
        {s.dark && (
          <div className="absolute inset-0 opacity-40" style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,.25) 1px, transparent 1.5px)',
            backgroundSize: '22px 22px',
          }} />
        )}

        {/* drag handle */}
        <div className="relative z-10 flex justify-center pt-3">
          <div className="w-10 h-1.5 rounded-full bg-white/60" />
        </div>

        {/* mock visual */}
        <div className="relative z-10 flex-1 grid place-items-center px-8">
          {s.key === 'trade' && <TradeMock />}
          {s.key === 'launch' && <LaunchMock />}
          {s.key === 'chat' && <ChatMock />}
          {s.key === 'lore' && <LoreMock />}
        </div>

        {/* copy */}
        <div className="relative z-10 px-8 text-center text-white">
          <h2 className="font-serif text-5xl mb-3" style={{ textShadow: '0 2px 20px rgba(0,0,0,.2)' }}>{s.title}</h2>
          <p className="text-white/90 text-lg leading-snug max-w-sm mx-auto">{s.body}</p>

          {/* dots */}
          <div className="flex justify-center gap-1.5 my-6">
            {SLIDES.map((_, k) => (
              <button key={k} onClick={() => setI(k)} className="h-1.5 rounded-full transition-all"
                style={{ width: k === i ? 24 : 8, background: k === i ? '#fff' : 'rgba(255,255,255,.4)' }} />
            ))}
          </div>

          <button
            onClick={() => (last ? onClose() : setI(i + 1))}
            className="btn btn-white w-full mb-6 !py-3.5 text-base"
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
    <div className="w-full max-w-[280px] rounded-2xl p-4 border border-white/15" style={{ background: 'rgba(255,255,255,.06)' }}>
      <div className="flex items-center gap-2 mb-2">
        <Back size={16} stroke="#cdd9f5" />
        <CharmAvatar charm={A} size={24} />
        <span className="text-white font-semibold text-sm">{A.name}</span>
        <Verified size={13} />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-white font-bold text-2xl">$6.8M</span>
        <span className="text-white/60 text-xs font-semibold">MCAP</span>
      </div>
      <div className="text-[var(--color-up)] text-sm font-semibold mb-2">▲ 1.58%</div>
      <Sparkline data={A.history} up width={248} height={70} strokeWidth={2.5} />
    </div>
  )
}

function LaunchMock() {
  return (
    <div className="w-full max-w-[260px] rounded-3xl p-6 flex flex-col items-center text-center border border-white/40"
      style={{ background: 'rgba(255,255,255,.14)', backdropFilter: 'blur(6px)' }}>
      <CharmAvatar charm={L} size={80} ring />
      <div className="font-serif text-2xl text-white mt-3">{L.name}</div>
      <div className="font-mono font-bold text-white/95">${L.ticker}</div>
      <div className="flex gap-1.5 mt-2">
        {['Cozy', 'Fun', 'Hype'].map((t) => (
          <span key={t} className="text-[11px] font-semibold text-white/90 bg-white/20 rounded-full px-2 py-0.5">{t}</span>
        ))}
      </div>
    </div>
  )
}

function ChatMock() {
  return (
    <div className="relative w-full max-w-[300px]">
      <div className="rounded-2xl p-3 border border-white/40" style={{ background: 'rgba(255,255,255,.5)', backdropFilter: 'blur(6px)' }}>
        <div className="flex items-center justify-between mb-2">
          <Back size={14} />
          <div className="flex items-center gap-1.5"><CharmAvatar charm={C} size={20} /><span className="font-semibold text-sm">{C.name}</span></div>
          <span className="text-[10px] font-semibold bg-[var(--color-ink)] text-white rounded-full px-2 py-0.5">Trade</span>
        </div>
        <div className="flex justify-start">
          <div className="bg-[rgba(47,125,255,.16)] text-[var(--color-ink)] text-xs rounded-2xl rounded-bl-sm px-3 py-2 max-w-[80%]">
            gm — {C.name} here. {C.voice.split(',')[0]}. what’s the situation? 🐾
          </div>
        </div>
      </div>
      <div className="absolute -left-3 -bottom-6 w-16 h-10 rounded-full bg-white/70" style={{ filter: 'blur(1px)' }} />
      <div className="absolute right-2 -bottom-7 w-28 h-11 rounded-full bg-[var(--color-sky-deep)]" style={{ filter: 'blur(1px)' }} />
    </div>
  )
}

function LoreMock() {
  const tiles = [CHARMS[5], CHARMS[3], CHARMS[6], CHARMS[0]]
  return (
    <div className="relative w-full max-w-[300px]">
      <div className="rounded-2xl p-3 bg-white/85">
        <div className="font-serif text-lg mb-2">Your recent creations</div>
        <div className="grid grid-cols-2 gap-2">
          {tiles.map((c) => (
            <div key={c.id} className="h-20 rounded-xl grid place-items-center text-3xl"
              style={{ background: `linear-gradient(140deg, hsl(${c.hue} 80% 72%), hsl(${(c.hue + 40) % 360} 75% 58%))` }}>
              {c.emoji}
            </div>
          ))}
        </div>
      </div>
      <span className="absolute -top-3 -right-2 flex items-center gap-1 bg-white rounded-full px-2.5 py-1 text-sm font-bold shadow">
        <span className="text-[var(--color-sky-deep)]">✦</span> 50
      </span>
      <span className="absolute -left-3 top-6 bg-white/90 rounded-full px-3 py-1 text-sm font-semibold shadow">ft. Nimbus</span>
      <span className="absolute -bottom-4 right-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-white shadow"
        style={{ background: 'var(--color-sky-deep)' }}>↻ Remix</span>
    </div>
  )
}
