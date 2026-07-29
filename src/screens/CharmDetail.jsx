import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { tokenToAgent } from '../lib/agents'
import CharmAvatar from '../components/CharmAvatar'
import PriceChart from '../components/PriceChart'
import TradePanel from '../components/TradePanel'
import CreatorFees from '../components/CreatorFees'
import { usd, num, pct } from '../lib/format'
import { Verified, XLogo, Back } from '../components/icons'

/**
 * Agent page — a real pons coin, dressed as a character. Chat with it, and trade
 * it right here: the pons-style swap sits directly under the header.
 */
export default function CharmDetail() {
  const { id } = useParams()
  const { getAgent, prices, explorer, agentsLoading } = useStore()
  const feedCharm = getAgent(id)

  // A brand-new coin (or a deep link before the feed loads) may not be in the
  // in-memory feed yet. Fetch it directly from the launched-here registry so the
  // page always resolves instead of showing "Agent not found".
  const [fallback, setFallback] = useState(null)
  const [fetching, setFetching] = useState(false)
  useEffect(() => {
    if (feedCharm || fallback) return
    let cancelled = false
    setFetching(true)
    const isAddr = /^0x[a-fA-F0-9]{40}$/.test(String(id))
    // Not a launched-here coin, but a valid address — read its real symbol/name
    // straight from the token contract so the page shows the coin properly (not
    // a generic "$TOKEN"). The swap works off the address, so any Robinhood
    // Chain coin is tradeable here.
    const minimal = () =>
      fetch(`/api/wallet?network=robinhood&token=${id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((w) => {
          if (cancelled) return
          const t = w?.token
          setFallback(tokenToAgent({ token: id, symbol: t?.symbol, name: t?.name }, null))
        })
        .catch(() => { if (!cancelled) setFallback(tokenToAgent({ token: id }, null)) })

    fetch(`/api/registry?network=robinhood`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled) return
        const t = j?.launches?.find((l) => (l.token || '').toLowerCase() === String(id).toLowerCase())
        if (t) { setFallback(tokenToAgent(t, j.ethUsd ?? null)); return }
        // Only a non-address id is truly "not found".
        if (isAddr) return minimal()
      })
      .catch(() => { if (!cancelled && isAddr) return minimal() })
      .finally(() => { if (!cancelled) setFetching(false) })
    return () => { cancelled = true }
  }, [id, feedCharm, fallback])

  const charm = feedCharm || fallback

  if (!charm) {
    return (
      <div className="text-center py-20 text-[var(--color-ink-soft)]">
        {agentsLoading || fetching ? 'Loading agent…' : <>Agent not found. <Link className="underline" to="/">Back to Discover</Link></>}
      </div>
    )
  }

  const price = prices[charm.id] ?? charm.price
  const grad = charm.graduated
  const addr = charm.token

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
        <Back size={15} /> Discover
      </Link>

      {/* header */}
      <div className="card p-6">
        <div className="flex items-start gap-4">
          <CharmAvatar charm={charm} size={68} ring />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-serif text-3xl">{charm.name}</h1>
              <Verified size={16} />
              <span className="font-mono text-sm text-[var(--color-ink-faint)]">${charm.ticker}</span>
              {grad === true && <span className="chip chip-up">Graduated</span>}
            </div>
            <div className="flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)] mt-1 flex-wrap">
              <XLogo size={10} /><span>{charm.creator}</span>
              {addr && <><span className="opacity-40">·</span><CopyCA addr={addr} /></>}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {charm.vibe.map((v) => <span key={v} className="chip">{v}</span>)}
            </div>
          </div>
        </div>
        <div className="mt-5">
          <Link to={`/chat/${charm.id}`} className="btn btn-primary w-full">Chat with {charm.name}</Link>
        </div>
      </div>

      {/* creator fees — only shown to the wallet that launched this coin */}
      {addr && <CreatorFees token={addr} symbol={charm.ticker} />}

      {/* about */}
      <div className="card p-6">
        <div className="eyebrow mb-2">About</div>
        <p className="text-[var(--color-ink)] leading-relaxed">{charm.lore}</p>
      </div>

      {/* trade — pons-style */}
      <TradePanel token={addr} symbol={charm.ticker} name={charm.name} logo={charm.logo} />

      {/* price + chart */}
      <div className="card p-6">
        <div className="flex items-end justify-between mb-5">
          <div>
            <div className="eyebrow mb-1">Price</div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="font-mono num text-3xl font-semibold">{price ? usd(price) : '—'}</div>
              {charm.change24 != null && (
                <span className={`chip !text-sm ${charm.change24 >= 0 ? 'chip-up' : 'chip-down'}`}>{pct(charm.change24)} · 24h</span>
              )}
            </div>
          </div>
          {typeof charm.graduationProgress === 'number' && grad !== true && (
            <span className="chip !text-sm">{Math.round(charm.graduationProgress * 100)}% to graduation</span>
          )}
        </div>
        <PriceChart seed={charm.history} live={price} up={charm.change24 == null ? true : charm.change24 >= 0} />
        <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t hairline">
          <Stat label="Market cap" value={charm.mcap ? usd(charm.mcap) : '—'} />
          <Stat label="Holders" value={charm.holders != null ? num(charm.holders) : '—'} />
          <Stat label="Supply" value={num(charm.supply)} />
        </div>
        {explorer && addr && (
          <a href={`${explorer}/token/${addr}`} target="_blank" rel="noopener noreferrer"
            className="inline-block mt-4 text-xs text-[var(--color-accent)] hover:underline">View on explorer ↗</a>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="font-mono num font-semibold">{value}</div>
      <div className="text-xs text-[var(--color-ink-soft)] mt-0.5">{label}</div>
    </div>
  )
}

/** Tap to copy the full contract address, with brief "Copied" feedback. */
function CopyCA({ addr }) {
  const [copied, setCopied] = useState(false)
  const copy = async (e) => {
    e.preventDefault(); e.stopPropagation()
    try {
      await navigator.clipboard.writeText(addr)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {}
  }
  return (
    <button onClick={copy} title="Copy contract address"
      className="inline-flex items-center gap-1 font-mono text-xs px-1.5 py-0.5 -my-0.5 rounded-md hover:bg-[var(--color-paper-2)] hover:text-[var(--color-ink)] transition">
      <span>{addr.slice(0, 6)}…{addr.slice(-4)}</span>
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-up)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
      )}
    </button>
  )
}
