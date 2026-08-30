import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import CharmAvatar from '../components/CharmAvatar'
import { timeAgo } from '../lib/format'

/**
 * Chats - talk to the coins. Each thread is a real pons agent.
 */
export default function Chats() {
  const { chats, getAgent, agents, agentsLoading } = useStore()
  const tr = useT()

  const threads = Object.entries(chats)
    .map(([id, msgs]) => ({ agent: getAgent(id), last: msgs[msgs.length - 1] }))
    .filter((t) => t.agent && t.last)
    .sort((a, b) => b.last.ts - a.last.ts)

  const suggestions = agents.filter((c) => !chats[c.id]).slice(0, 6)

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="font-serif text-4xl mb-1">{tr('chats.title', 'Chats')}</h1>
      <p className="text-[var(--color-ink-soft)] mb-8">{tr('chats.subtitle', 'Every coin on Robinhood Chain is an agent. Talk to it, then trade it.')}</p>

      {threads.length > 0 && (
        <div className="card overflow-hidden mb-10">
          {threads.map(({ agent, last }, i) => (
            <Link key={agent.id} to={`/chat/${agent.id}`}
              className={`flex items-center gap-3 p-4 hover:bg-[var(--color-paper-2)] ${i ? 'border-t hairline' : ''}`}>
              <CharmAvatar charm={agent} size={44} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{agent.name} <span className="text-xs text-[var(--color-ink-faint)] font-mono">${agent.ticker}</span></span>
                  <span className="text-xs text-[var(--color-ink-faint)]">{timeAgo(last.ts)}</span>
                </div>
                <div className="text-sm text-[var(--color-ink-soft)] truncate">
                  {last.role === 'user' ? tr('chats.youPrefix', 'You: ') : ''}{last.text}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <h2 className="font-serif text-2xl mb-4">{threads.length ? tr('chats.talkAnother', 'Talk to another coin') : tr('chats.start', 'Start a conversation')}</h2>
      {agentsLoading && suggestions.length === 0 ? (
        <div className="text-[var(--color-ink-soft)] text-sm">{tr('chats.loading', 'Loading agents…')}</div>
      ) : suggestions.length === 0 ? (
        <div className="text-[var(--color-ink-soft)] text-sm">{tr('chats.noneA', 'No coins available to chat with yet.')} <Link to="/" className="underline">{tr('common.discover', 'Discover')}</Link> {tr('common.or', 'or')} <Link to="/launch" className="underline">{tr('chats.launchOne', 'launch one')}</Link>.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {suggestions.map((c) => (
            <Link key={c.id} to={`/chat/${c.id}`} className="card card-hover p-4 flex items-center gap-3">
              <CharmAvatar charm={c} size={44} />
              <div className="min-w-0">
                <div className="font-medium truncate">{c.name}</div>
                <div className="text-xs text-[var(--color-ink-soft)] truncate">{c.tagline}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
