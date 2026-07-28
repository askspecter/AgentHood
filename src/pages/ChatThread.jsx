import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import CharmAvatar from '../components/CharmAvatar'
import { usd } from '../lib/format'
import { Back } from '../components/icons'

export default function ChatThread() {
  const { id } = useParams()
  const { getCharm, chats, sendMessage, prices } = useStore()
  const charm = getCharm(id)
  const [text, setText] = useState('')
  const endRef = useRef(null)
  const msgs = chats[id] ?? []

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs.length])

  if (!charm) return <div className="text-center py-20 text-[var(--color-ink-soft)]">Character not found.</div>

  function submit(e) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    sendMessage(id, t)
    setText('')
  }

  const starters = ['gm, how are you today?', `what's your deal, ${charm.name}?`, 'hype me up', 'tell me a secret']

  return (
    <div className="max-w-2xl mx-auto flex flex-col" style={{ minHeight: 'calc(100vh - 8rem)' }}>
      {/* header */}
      <div className="card p-4 flex items-center gap-3 mb-4">
        <Link to="/chats" className="grid place-items-center w-8 h-8 rounded-full bg-white/5 border border-white/12"><Back size={16} /></Link>
        <CharmAvatar charm={charm} size={42} />
        <div className="flex-1">
          <div className="font-serif text-lg leading-none">{charm.name}</div>
          <div className="text-xs text-[var(--color-ink-soft)] mt-1">
            {charm.online ? 'online now' : 'away'} · ${charm.ticker} {usd(prices[charm.id] ?? charm.price)}
          </div>
        </div>
        <Link to={`/c/${charm.id}`} className="btn btn-accent text-xs !py-1.5">Trade</Link>
      </div>

      {/* messages */}
      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {msgs.length === 0 && (
          <div className="card card-glow p-6 text-center">
            <div className="flex justify-center"><CharmAvatar charm={charm} size={56} ring /></div>
            <p className="mt-4 font-serif text-2xl">{charm.name}</p>
            <p className="text-sm text-[var(--color-ink-soft)] mt-1 max-w-sm mx-auto">{charm.lore}</p>
            <div className="flex flex-wrap gap-2 justify-center mt-5">
              {starters.map((s) => (
                <button key={s} onClick={() => sendMessage(id, s)} className="chip hover:bg-white/10">{s}</button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'charm' && <CharmAvatar charm={charm} size={30} />}
            <div
              className={`max-w-[75%] px-4 py-2.5 text-sm leading-relaxed ml-2 rounded-2xl ${
                m.role === 'user'
                  ? 'rounded-br-md text-[#14110a] font-medium'
                  : 'rounded-bl-md card'
              }`}
              style={m.role === 'user' ? { background: 'linear-gradient(180deg,#f0c37b,#cfa156)' } : undefined}
            >
              {m.text}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* composer */}
      <form onSubmit={submit} className="mt-4 flex gap-2 sticky bottom-20 md:bottom-4">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Message ${charm.name}`}
          className="flex-1 card !rounded-full px-5 py-3 text-sm outline-none bg-transparent focus:border-[rgba(217,165,82,.5)]"
        />
        <button className="btn btn-primary" disabled={!text.trim()}>Send</button>
      </form>
      <p className="text-[10px] text-center text-[var(--color-ink-soft)] mt-2 mb-4">
        Demo AI. Replies are scripted from {charm.name}'s personality, not a live model.
      </p>
    </div>
  )
}
