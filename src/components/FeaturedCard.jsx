import { useNavigate } from 'react-router-dom'
import CharmAvatar from './CharmAvatar'
import { Verified, Mentions, ArrowStat, XLogo } from './icons'
import { usd, num } from '../lib/format'

export default function FeaturedCard({ charm }) {
  const nav = useNavigate()
  const up = charm.change24 >= 0
  const handle = charm.creator
  const scene = `linear-gradient(180deg,
      hsl(${charm.hue} 75% 72%) 0%,
      hsl(${charm.hue} 68% 62%) 42%,
      hsl(${(charm.hue + 12) % 360} 55% 40%) 100%)`

  return (
    <div
      onClick={() => nav(`/c/${charm.id}`)}
      className="relative shrink-0 w-full overflow-hidden cursor-pointer"
      style={{ background: scene, borderRadius: 28, minHeight: 380 }}
    >
      {/* clouds */}
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute" style={{ top: 34, left: 26, width: 90, height: 34, background: '#fdfbe8', borderRadius: 999, filter: 'blur(2px)' }} />
        <div className="absolute" style={{ top: 58, right: 40, width: 120, height: 40, background: '#fdfbe8', borderRadius: 999, filter: 'blur(2px)' }} />
        <div className="absolute" style={{ top: 150, right: 70, width: 80, height: 28, background: '#fdfbe8', borderRadius: 999, filter: 'blur(2px)' }} />
      </div>

      <div className="relative z-10 flex flex-col items-center pt-9 px-6">
        <CharmAvatar charm={charm} size={132} ring />
        <div className="mt-4 flex items-center gap-1.5 text-white">
          <span className="font-serif text-3xl leading-none drop-shadow">{charm.name}</span>
          <span>🪶</span>
          <Verified size={18} />
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-white/90 text-sm">
          <XLogo size={13} /> <span>{handle}</span>
        </div>
        <div className="mt-2 flex items-center gap-4 text-white font-semibold">
          <span className="flex items-center gap-1.5">{usd(charm.mcap)} <ArrowStat up={up} /></span>
          <span className="flex items-center gap-1.5">{num(charm.holders)} <Mentions /></span>
        </div>
      </div>

      <div className="relative z-10 flex items-end justify-between gap-3 px-6 pb-6 pt-6">
        <p className="font-serif italic text-white text-2xl leading-tight drop-shadow max-w-[62%]">
          {charm.tagline.replace(/\.$/, '')}
        </p>
        <button
          onClick={(e) => { e.stopPropagation(); nav(`/c/${charm.id}`) }}
          className="btn btn-white text-sm shrink-0"
        >
          Trade
        </button>
      </div>
    </div>
  )
}
