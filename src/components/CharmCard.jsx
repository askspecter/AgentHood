import { useNavigate } from 'react-router-dom'
import CharmAvatar from './CharmAvatar'
import { usd, num } from '../lib/format'
import { Verified, Mentions, ArrowStat } from './icons'

export default function CharmCard({ charm }) {
  const nav = useNavigate()
  const up = charm.change24 >= 0

  return (
    <div
      onClick={() => nav(`/c/${charm.id}`)}
      className="card p-4 flex flex-col items-center text-center cursor-pointer transition-transform hover:-translate-y-0.5"
      style={{ boxShadow: `0 24px 60px -34px hsl(${charm.hue} 70% 40% / .5)` }}
    >
      <CharmAvatar charm={charm} size={80} />
      <div className="mt-3 flex items-center gap-1.5">
        <span className="font-serif text-xl leading-none">{charm.name}</span>
        <Verified size={15} />
      </div>
      <div className="mt-2 flex items-center justify-center gap-3 text-sm text-[var(--color-ink-soft)] font-semibold">
        <span className="flex items-center gap-1 font-mono text-[13px]">{usd(charm.mcap)} <ArrowStat up={up} size={15} /></span>
        <span className="flex items-center gap-1 font-mono text-[13px]">{num(charm.holders)} <Mentions size={13} /></span>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); nav(`/c/${charm.id}`) }}
        className="btn btn-ghost w-full mt-3 !py-2 text-sm"
      >
        Trade
      </button>
    </div>
  )
}
