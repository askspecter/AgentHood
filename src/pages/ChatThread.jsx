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

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs.length])
  if (!charm) return <div className="text-center py-20 text-[var(--color-ink-soft)]">Character not found.</div>

  function submit(e) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    sendMessage(id, t); setText('')
  }

  const starters = ['gm, how are you today?', `what's your deal, ${charm.name}?`, 'hype me up', 'tell me a secret']

  return (
    <div className="max-w-2xl mx-auto flex flex-col" style={{ minHeight: 'calc(100vh - 10rem)' }}>
      <div className="card p-3 flex items-center gap-3 mb-4">
        <Link to="/chats" className="grid place-items-center w-9 h-9 rounded-lg hover:bg-[#f4f4f5]"><Back size={17} /></Link>
        <CharmAvatar charm={charm} size={40} />
        <div className="flex-1">
          <div className="font-medium leading-tight">{charm.name}</div>
          <div className="text-xs text-[var(--color-ink-soft)]">
            {charm.online ? 'Online' : 'Away'} · <span className="font-mono">${charm.ticker} {usd(prices[charm.id] ?? charm.price)}</span>
          </div>
        </div>
        <Link to={`/c/${charm.id}`} className="btn btn-secondary !py-1.5 text-xs">Trade</Link>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto">
        {msgs.length === 0 && (
          <div className="card p-6 text-center">
            <div className="flex justify-center"><CharmAvatar charm={charm} size={56} ring /></div>
            <p className="mt-4 font-serif text-2xl">{charm.name}</p>
            <p className="text-sm text-[var(--color-ink-soft)] mt-1 max-w-sm mx-auto">{charm.lore}</p>
            <div className="flex flex-wrap gap-2 justify-center mt-5">
              {starters.map((s) => <button key={s} onClick={() => sendMessage(id, s)} className="chip hover:bg-[#e4e4e7]">{s}</button>)}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex items-end gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'charm' && <CharmAvatar charm={charm} size={28} />}
            <div className={`max-w-[76%] px-4 py-2.5 text-sm leading-relaxed rounded-2xl ${
              m.role === 'user' ? 'bg-[var(--color-ink)] text-white rounded-br-md' : 'card rounded-bl-md'
            }`}>{m.text}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="mt-4 flex gap-2 sticky bottom-20 md:bottom-4">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Message ${charm.name}`} className="input flex-1 !rounded-full !py-3" />
        <button className="btn btn-primary" disabled={!text.trim()}>Send</button>
      </form>
      <p className="text-[11px] text-center text-[var(--color-ink-faint)] mt-2 mb-4">
        Demo AI — replies are scripted from {charm.name}'s personality, not a live model.
      </p>
    </div>
  )
}
