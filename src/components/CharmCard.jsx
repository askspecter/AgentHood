import { useNavigate } from 'react-router-dom'
import CharmAvatar from './CharmAvatar'
import { useStore } from '../lib/store'
import { usd, num } from '../lib/format'
import { Verified, Mentions, ArrowStat } from './icons'

export default function CharmCard({ charm }) {
  const nav = useNavigate()
  const { prices } = useStore()
  const up = charm.change24 >= 0
  const verified = charm.followers > 12000 || charm.isMine
  const gold = charm.mcap >= 500000

  return (
    <div
      onClick={() => nav(`/c/${charm.id}`)}
      className="rounded-3xl p-4 flex flex-col items-center text-center cursor-pointer transition-transform hover:-translate-y-0.5"
      style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(20,32,59,.06)', boxShadow: '0 10px 30px -22px rgba(20,40,90,.5)' }}
    >
      <CharmAvatar charm={charm} size={84} />
      <div className="mt-3 flex items-center gap-1.5">
        <span className="font-semibold text-lg leading-none">{charm.name}</span>
        <Verified size={16} gold={gold} />
      </div>
      <div className="mt-2 flex items-center justify-center gap-3 text-sm text-[var(--color-ink-soft)] font-semibold">
        <span className="flex items-center gap-1">{usd(charm.mcap)} <ArrowStat up={up} size={16} /></span>
        <span className="flex items-center gap-1">{num(charm.holders)} <Mentions size={14} /></span>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); nav(`/c/${charm.id}`) }}
        className="btn btn-primary w-full mt-3 !py-2.5"
      >
        Trade
      </button>
    </div>
  )
}
