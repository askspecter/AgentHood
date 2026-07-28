import { useNavigate } from 'react-router-dom'
import CharmAvatar from './CharmAvatar'
import { Verified, Mentions, ArrowStat, XLogo } from './icons'
import { usd, num } from '../lib/format'

export default function FeaturedCard({ charm }) {
  const nav = useNavigate()
  const up = charm.change24 >= 0
  const h = charm.hue

  return (
    <div
      onClick={() => nav(`/c/${charm.id}`)}
      className="relative shrink-0 w-full overflow-hidden cursor-pointer border border-white/10"
      style={{
        borderRadius: 28,
        minHeight: 400,
        background: `
          radial-gradient(120% 90% at 50% -20%, hsl(${h} 60% 30% / .85), transparent 60%),
          radial-gradient(100% 80% at 80% 110%, hsl(${(h + 60) % 360} 55% 22% / .7), transparent 55%),
          linear-gradient(180deg, #0a0c14 0%, #06070c 100%)`,
        boxShadow: `0 30px 80px -30px hsl(${h} 70% 30% / .6)`,
      }}
    >
      {/* light streaks */}
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -left-10 top-10 h-px w-2/3"
          style={{ background: `linear-gradient(90deg, transparent, hsl(${h} 80% 70% / .5), transparent)` }} />
        <div className="absolute right-0 top-24 h-px w-1/2"
          style={{ background: `linear-gradient(90deg, transparent, rgba(255,255,255,.25), transparent)` }} />
      </div>
      {/* vignette */}
      <div className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(120% 90% at 50% 50%, transparent 55%, rgba(0,0,0,.5) 100%)' }} />

      <div className="relative z-10 flex flex-col items-center pt-10 px-6">
        <div className="drift">
          <CharmAvatar charm={charm} size={128} ring />
        </div>
        <div className="mt-5 flex items-center gap-2 text-white">
          <span className="font-serif text-4xl leading-none">{charm.name}</span>
          <Verified size={18} />
        </div>
        <div className="mt-2.5 flex items-center gap-2 text-white/70 text-sm">
          <XLogo size={11} /> <span>{charm.creator}</span>
        </div>
        <div className="mt-3 flex items-center gap-5 text-white font-semibold">
          <span className="flex items-center gap-1.5 font-mono">{usd(charm.mcap)} <ArrowStat up={up} /></span>
          <span className="flex items-center gap-1.5 font-mono">{num(charm.holders)} <Mentions /></span>
        </div>
      </div>

      <div className="relative z-10 flex items-end justify-between gap-3 px-7 pb-7 pt-8">
        <p className="font-serif italic text-white/95 text-2xl leading-tight max-w-[62%]">
          {charm.tagline.replace(/\.$/, '')}
        </p>
        <button
          onClick={(e) => { e.stopPropagation(); nav(`/c/${charm.id}`) }}
          className="btn btn-primary text-sm shrink-0"
        >
          Trade
        </button>
      </div>
    </div>
  )
}
