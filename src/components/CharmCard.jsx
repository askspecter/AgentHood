import { Link } from 'react-router-dom'
import CharmAvatar from './CharmAvatar'
import Sparkline from './Sparkline'
import { useStore } from '../lib/store'
import { usd, num, pct } from '../lib/format'

export default function CharmCard({ charm }) {
  const { prices } = useStore()
  const price = prices[charm.id] ?? charm.price
  const up = charm.change24 >= 0
  return (
    <Link to={`/c/${charm.id}`} className="card p-4 flex flex-col gap-3 hover:-translate-y-0.5 transition-transform">
      <div className="flex items-center gap-3">
        <CharmAvatar charm={charm} size={52} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-serif text-lg leading-none truncate">{charm.name}</span>
            {charm.isMine && <span className="chip !py-0.5 !px-2 text-[10px]">yours</span>}
          </div>
          <span className="font-mono text-xs text-[var(--color-ink-soft)]">${charm.ticker}</span>
        </div>
      </div>
      <p className="text-sm text-[var(--color-ink-soft)] line-clamp-2 min-h-[2.5rem]">{charm.tagline}</p>
      <div className="flex items-end justify-between">
        <div>
          <div className="font-mono font-semibold">{usd(price)}</div>
          <div className={`text-xs font-semibold ${up ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}`}>
            {pct(charm.change24)} · {num(charm.holders)} holders
          </div>
        </div>
        <Sparkline data={charm.history} up={up} width={110} height={40} />
      </div>
    </Link>
  )
}
