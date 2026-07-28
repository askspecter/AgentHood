import { useState } from 'react'
import CharmAvatar from './CharmAvatar'
import Sparkline from './Sparkline'
import { CHARMS } from '../data/charms'
import { Verified } from './icons'

const A = CHARMS[2]
const L = CHARMS[7]
const C = CHARMS[4]

const SLIDES = [
  { key: 'trade', title: 'Trade', body: 'Spot the next icon of the internet early, then trade its coin.' },
  { key: 'mint', title: 'Mint', body: 'Dream up a character, give it a face and a soul, and mint its coin.' },
  { key: 'chat', title: 'Chat', body: 'Talk to the character behind the coin. It remembers you.' },
  { key: 'lore', title: 'Shape the lore', body: 'Create and remix with the community until it becomes canon.' },
]

export default function IntroModal({ open, onClose }) {
  const [i, setI] = useState(0)
  if (!open) return null
  const s = SLIDES[i]
  const last = i === SLIDES.length - 1

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[rgba(24,24,27,.4)] backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md card overflow-hidden">
        <div className="h-56 grid place-items-center border-b hairline"
          style={{ background: 'var(--color-paper-2)' }}>
          {s.key === 'trade' && <TradeMock />}
          {s.key === 'mint' && <MintMock />}
          {s.key === 'chat' && <ChatMock />}
          {s.key === 'lore' && <LoreMock />}
        </div>
        <div className="p-6 text-center">
          <h2 className="font-serif text-3xl mb-2">{s.title}</h2>
          <p className="text-[var(--color-ink-soft)] max-w-sm mx-auto">{s.body}</p>
          <div className="flex justify-center gap-1.5 my-5">
            {SLIDES.map((_, k) => (
              <button key={k} onClick={() => setI(k)} className="h-1.5 rounded-full transition-all"
                style={{ width: k === i ? 22 : 6, background: k === i ? 'var(--color-ink)' : 'var(--color-line-2)' }} />
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-secondary flex-1">Skip</button>
            <button onClick={() => (last ? onClose() : setI(i + 1))} className="btn btn-primary flex-1">{last ? 'Get started' : 'Next'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TradeMock() {
  const up = A.change24 >= 0
  return (
    <div className="card w-64 p-4">
      <div className="flex items-center gap-2 mb-2">
        <CharmAvatar charm={A} size={26} />
        <span className="font-medium text-sm">{A.name}</span><Verified size={12} />
        <span className={`ml-auto chip ${up ? 'chip-up' : 'chip-down'} !text-[11px]`}>+1.58%</span>
      </div>
      <div className="font-mono num text-xl font-semibold mb-1">$6.8M</div>
      <Sparkline data={A.history} up width={224} height={54} />
    </div>
  )
}
function MintMock() {
  return (
    <div className="card w-52 p-5 flex flex-col items-center text-center">
      <CharmAvatar charm={L} size={64} ring />
      <div className="font-serif text-xl mt-3">{L.name}</div>
      <div className="font-mono text-xs text-[var(--color-ink-faint)]">${L.ticker}</div>
      <div className="flex gap-1.5 mt-2">{['cozy', 'fast', 'hype'].map((t) => <span key={t} className="chip">{t}</span>)}</div>
    </div>
  )
}
function ChatMock() {
  return (
    <div className="card w-72 p-3">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b hairline">
        <CharmAvatar charm={C} size={22} /><span className="font-medium text-sm">{C.name}</span>
      </div>
      <div className="flex justify-start mb-2"><div className="chip !rounded-2xl !rounded-bl-sm max-w-[85%]">gm — {C.name} here.</div></div>
      <div className="flex justify-end"><div className="bg-[var(--color-ink)] text-white text-xs rounded-2xl rounded-br-sm px-3 py-1.5">good boy</div></div>
    </div>
  )
}
function LoreMock() {
  const tiles = [CHARMS[5], CHARMS[3], CHARMS[6], CHARMS[0]]
  return (
    <div className="grid grid-cols-4 gap-2">
      {tiles.map((c) => <CharmAvatar key={c.id} charm={c} size={52} square />)}
    </div>
  )
}
