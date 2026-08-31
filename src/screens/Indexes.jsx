import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Back } from '../components/icons'
import { useT } from '../lib/i18n'
import { kusd } from '../lib/indexes'

/**
 * Index baskets - curated themes of tokenized Robinhood-Chain stocks, each with a
 * live reference NAV computed from real on-chain issuer quotes (/api/index). From
 * here a creator can launch a Pons coin that tracks a basket in one tap.
 *
 * Honest by design: these are thematic tracking coins, not collateralized or
 * redeemable claims on the underlying stocks. The screen says so plainly.
 */
const NETWORK = 'robinhood'

export default function Indexes() {
  const nav = useNavigate()
  const tr = useT()
  const [baskets, setBaskets] = useState(null) // null=loading

  useEffect(() => {
    let cancelled = false
    fetch(`/api/index?network=${NETWORK}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled) setBaskets(Array.isArray(j?.baskets) ? j.baskets : []) })
      .catch(() => { if (!cancelled) setBaskets([]) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => nav(-1)} className="grid place-items-center w-10 h-10 rounded-lg border hairline hover:bg-[var(--color-paper-2)]"><Back size={18} /></button>
        <h1 className="font-serif text-3xl">{tr('index.title', 'Index baskets')}</h1>
      </div>

      <p className="text-[var(--color-ink-soft)] mb-3 max-w-xl">{tr('index.subtitle', 'Themes of tokenized stocks on Robinhood Chain. Launch a coin that tracks one, priced live from real on-chain quotes.')}</p>

      <div className="inline-flex items-center gap-2 mb-5 px-3 py-1.5 rounded-full" style={{ background: 'rgba(55,91,210,0.12)', border: '1px solid rgba(55,91,210,0.4)' }}>
        <ChainlinkMark size={15} />
        <span className="text-xs text-[#8ea6ff]">{tr('index.chainlink', 'Prices verified by Chainlink on Robinhood Chain')}</span>
      </div>

      {baskets === null ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-40 animate-pulse opacity-40" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {baskets.map((b) => <BasketCard key={b.key} b={b} onLaunch={() => nav(launchLink(b))} tr={tr} />)}
        </div>
      )}

      <p className="text-[11px] text-[var(--color-ink-faint)] leading-relaxed mt-6 px-1">
        {tr('index.disclaimer', 'Index coins are thematic tracking coins. They are not collateralized by, backed by, or redeemable for the underlying stocks. NAV is a reference number from live issuer quotes.')}
      </p>
    </div>
  )
}

/* Build the /launch deep link that lands prefilled for a coin tracking a basket:
   v2 bonding curve, paired to the basket's lead priced stock, with a description
   naming the theme. Uses the launch screen's query-param prefill. */
function launchLink(b) {
  const lead = [...b.constituents]
    .filter((c) => c.priceUsd != null && c.address)
    .sort((a, c) => c.weight - a.weight)[0]
  const symbols = b.constituents.map((c) => c.symbol).join(', ')
  const desc = `Tracks the ${b.name} basket: ${symbols}. A thematic AURN index coin, priced live from on-chain stock quotes. Not collateralized or redeemable.`
  const p = new URLSearchParams()
  p.set('name', `${b.name} Index`)
  p.set('description', desc)
  p.set('version', 'v2')
  if (lead) { p.set('pairToken', lead.address); p.set('pairSymbol', lead.symbol) }
  return `/launch?${p.toString()}`
}

function BasketCard({ b, onLaunch, tr }) {
  const shown = b.constituents.slice(0, 8)
  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <span className="w-12 h-12 rounded-2xl grid place-items-center text-2xl shrink-0"
          style={{ background: `radial-gradient(120% 120% at 32% 22%, ${b.tint[0]}, ${b.tint[1]} 120%)` }}>{b.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="font-serif text-2xl leading-tight">{b.name}</div>
          <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">{b.blurb}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="eyebrow mb-0.5 flex items-center justify-end gap-1">
            {b.oracle?.chainlink > 0 && <ChainlinkMark size={12} />}
            {tr('index.nav', 'Live NAV')}
          </div>
          <div className="font-mono num text-xl font-semibold holo-text leading-none">{kusd(b.navUsd)}</div>
          <div className="text-[10px] text-[var(--color-ink-faint)] mt-1">{tr('index.perUnit', 'per basket unit')}</div>
        </div>
      </div>

      {/* constituents */}
      <div className="mt-4 pt-4 border-t hairline">
        <div className="eyebrow mb-2.5">{tr('index.tracks', 'Tracks')} <span className="text-[var(--color-ink-faint)] normal-case tracking-normal">· {b.coverage.priced}/{b.coverage.total} {tr('index.pricedLive', 'priced live')}</span></div>
        <div className="flex flex-wrap gap-2">
          {shown.map((c) => (
            <span key={c.symbol} className="inline-flex items-center gap-1.5 chip !py-1.5" title={c.name}>
              <StockLogo c={c} />
              <span className="font-mono text-xs font-semibold">{c.symbol}</span>
              {c.weightPct != null && <span className="text-[10px] text-[var(--color-ink-faint)]">{Math.round(c.weightPct)}%</span>}
            </span>
          ))}
        </div>
      </div>

      <button onClick={onLaunch} className="btn btn-holo w-full !py-3 mt-4">{tr('index.launchTracking', 'Launch a coin tracking this')}</button>
    </div>
  )
}

/* The Chainlink hexagon mark, in Chainlink blue. */
function ChainlinkMark({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden shapeRendering="geometricPrecision">
      <path d="M16 2.8l11.4 6.6v13.2L16 29.2 4.6 22.6V9.4L16 2.8z" fill="#375BD2" />
      <path d="M16 9.1l6 3.45v6.9L16 22.9l-6-3.45v-6.9L16 9.1z" fill="#fff" />
    </svg>
  )
}

/* A small stock logo on a light tile, with a letter fallback (dark marks stay
   visible; a missing/blocked logo never leaves a hole). */
function StockLogo({ c, size = 18 }) {
  const [broken, setBroken] = useState(false)
  const src = c.logo && /^https?:\/\//.test(c.logo) ? `/api/img?src=${encodeURIComponent(c.logo)}` : c.logo
  if (src && !broken) {
    return (
      <span className="rounded-md grid place-items-center overflow-hidden shrink-0" style={{ width: size, height: size, background: '#eef2fb' }}>
        <img src={src} alt="" onError={() => setBroken(true)} className="w-full h-full object-contain p-[1px]" />
      </span>
    )
  }
  return (
    <span className="rounded-md grid place-items-center font-mono text-[9px] font-bold shrink-0 bg-[var(--color-paper-2)] text-[var(--color-ink-soft)]"
      style={{ width: size, height: size }}>{c.symbol[0]}</span>
  )
}
