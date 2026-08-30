import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import CharmAvatar from '../components/CharmAvatar'
import { usd } from '../lib/format'
import { Back } from '../components/icons'

/* Fill a {name} placeholder in a translated string. */
const withName = (s, name) => String(s || '').replace('{name}', name)

/**
 * Chat with a pons agent. Replies are local, ticker-aware flavour (no model);
 * the coin itself is real, and Trade opens the on-chain swap.
 */
export default function ChatThread() {
  const { id } = useParams()
  const nav = useNavigate()
  const { getAgent, chats, sendMessage, prices, agentsLoading, chatTyping } = useStore()
  const tr = useT()
  const charm = getAgent(id)
  const [text, setText] = useState('')
  const endRef = useRef(null)
  const msgs = chats[id] ?? []
  const typing = Boolean(chatTyping?.[id])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs.length, typing])

  if (!charm) {
    return <div className="text-center py-20 text-[var(--color-ink-soft)]">{agentsLoading ? tr('common.loadingAgent', 'Loading agent…') : <>{tr('chat.notFound', 'Agent not found.')} <Link className="underline" to="/chats">{tr('chat.backToChats', 'Back to chats')}</Link></>}</div>
  }

  function submit(e) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    sendMessage(id, t); setText('')
  }

  const price = prices[charm.id] ?? charm.price
  const starters = [
    tr('chat.starter1', 'gm, how are you?'),
    withName(tr('chat.starter2', "what's your deal, {name}?"), charm.name),
    tr('chat.starter3', 'should I buy?'),
    tr('chat.starter4', 'how is your market cap?'),
  ]

  return (
    <div className="max-w-2xl mx-auto flex flex-col" style={{ minHeight: 'calc(100vh - 10rem)' }}>
      <div className="card p-3 flex items-center gap-3 mb-4">
        <Link to="/chats" className="grid place-items-center w-9 h-9 rounded-lg hover:bg-[var(--color-paper-2)]"><Back size={17} /></Link>
        <CharmAvatar charm={charm} size={40} />
        <div className="flex-1 min-w-0">
          <div className="font-medium leading-tight truncate">{charm.name}</div>
          <div className="text-xs text-[var(--color-ink-soft)]">
            {tr('chat.online', 'Online')} · <span className="font-mono">${charm.ticker} {charm.priceUsd != null ? usd(price) : ''}</span>
          </div>
        </div>
        <button onClick={() => nav(`/c/${charm.token}`)} className="btn btn-secondary !py-1.5 text-xs">{tr('action.trade', 'Trade')}</button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto">
        {msgs.length === 0 && (
          <div className="card p-6 text-center">
            <div className="flex justify-center"><CharmAvatar charm={charm} size={56} ring /></div>
            <p className="mt-4 font-serif text-2xl">{charm.name}</p>
            <p className="text-sm text-[var(--color-ink-soft)] mt-1 max-w-sm mx-auto">{charm.lore}</p>
            <div className="flex flex-wrap gap-2 justify-center mt-5">
              {starters.map((s) => <button key={s} onClick={() => sendMessage(id, s)} className="chip hover:bg-[var(--color-line)]">{s}</button>)}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex items-end gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'charm' && <CharmAvatar charm={charm} size={28} />}
            <div className={`max-w-[76%] px-4 py-2.5 text-sm leading-relaxed rounded-2xl ${m.role === 'user' ? 'text-white rounded-br-md' : 'card rounded-bl-md'}`}
              style={m.role === 'user' ? { background: 'linear-gradient(180deg,#5f79c6,#43589f)' } : undefined}>{m.text}{m.streaming && <span className="stream-caret" />}</div>
          </div>
        ))}
        {typing && (
          <div className="flex items-end gap-2 justify-start">
            <CharmAvatar charm={charm} size={28} />
            <div className="card rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
              <span className="typing-dot" /><span className="typing-dot" style={{ animationDelay: '0.18s' }} /><span className="typing-dot" style={{ animationDelay: '0.36s' }} />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="mt-4 flex gap-2 sticky bottom-20 md:bottom-4">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={withName(tr('chat.messagePh', 'Message {name}'), charm.name)} className="input flex-1 !rounded-full !py-3" />
        <button className="btn btn-primary" disabled={!text.trim()}>{tr('chat.send', 'Send')}</button>
      </form>
      <p className="text-[11px] text-center text-[var(--color-ink-faint)] mt-2 mb-4">
        {tr('chat.disclaimer', '${ticker} speaks for itself - playful, not financial advice. The coin is real; trade it anytime.').replace('{ticker}', charm.ticker)}
      </p>
    </div>
  )
}
