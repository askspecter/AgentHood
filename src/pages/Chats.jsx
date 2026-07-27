import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import CharmAvatar from '../components/CharmAvatar'
import { timeAgo } from '../lib/format'

export default function Chats() {
  const { chats, getCharm, charms } = useStore()
  const threads = Object.entries(chats)
    .map(([id, msgs]) => ({ charm: getCharm(id), last: msgs[msgs.length - 1] }))
    .filter((t) => t.charm && t.last)
    .sort((a, b) => b.last.ts - a.last.ts)

  const suggestions = charms.filter((c) => c.online && !chats[c.id]).slice(0, 6)

  return (
    <div>
      <h1 className="font-serif text-4xl mb-1">Chats</h1>
      <p className="text-[var(--color-ink-soft)] mb-6">Your charms remember. Keep the conversation going.</p>

      {threads.length > 0 && (
        <div className="card divide-y divide-[rgba(20,32,59,.07)] mb-8 overflow-hidden">
          {threads.map(({ charm, last }) => (
            <Link key={charm.id} to={`/app/chat/${charm.id}`} className="flex items-center gap-3 p-4 hover:bg-white/60">
              <CharmAvatar charm={charm} size={48} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{charm.name}</span>
                  <span className="text-xs text-[var(--color-ink-soft)]">{timeAgo(last.ts)}</span>
                </div>
                <div className="text-sm text-[var(--color-ink-soft)] truncate">
                  {last.role === 'user' ? 'You: ' : ''}{last.text}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <h2 className="font-serif text-2xl mb-3">{threads.length ? 'Say hi to someone new' : 'Start a conversation'}</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {suggestions.map((c) => (
          <Link key={c.id} to={`/app/chat/${c.id}`} className="card p-4 flex items-center gap-3 hover:-translate-y-0.5 transition-transform">
            <CharmAvatar charm={c} size={44} />
            <div className="min-w-0">
              <div className="font-semibold text-sm">{c.name}</div>
              <div className="text-xs text-[var(--color-ink-soft)] truncate">{c.tagline}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
