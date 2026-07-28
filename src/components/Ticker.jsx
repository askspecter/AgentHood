import { usd, pct } from '../lib/format'

export default function Ticker({ charms, prices }) {
  const items = [...charms, ...charms]
  return (
    <div className="marquee-wrap overflow-hidden border-y hairline py-3 mb-10 bg-white">
      <div className="marquee">
        {items.map((c, k) => {
          const up = c.change24 >= 0
          return (
            <span key={k} className="flex items-center gap-2.5 text-sm shrink-0">
              <span className="font-mono font-medium">${c.ticker}</span>
              <span className="font-mono num text-[var(--color-ink-soft)]">{usd(prices[c.id] ?? c.price)}</span>
              <span className={`font-mono num text-xs ${up ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}`}>{pct(c.change24)}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
