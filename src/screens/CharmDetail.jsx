import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import { tokenToAgent } from '../lib/agents'
import CharmAvatar from '../components/CharmAvatar'
import PriceChart from '../components/PriceChart'
import TradePanel from '../components/TradePanel'
import CreatorFees from '../components/CreatorFees'
import { usd, num, pct } from '../lib/format'
import { Verified, Back } from '../components/icons'

/**
 * Agent page - a real pons coin, dressed as a character. Chat with it, and trade
 * it right here: the pons-style swap sits directly under the header.
 */
export default function CharmDetail() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const tr = useT()
  const { getAgent, prices, explorer, agentsLoading } = useStore()
  const feedCharm = getAgent(id)

  // Deep-link trade intent: /c/<token>?action=trade&side=buy&amount=0.1 - lands
  // from a prepared MCP link. Prefills the swap and scrolls it into focus so the
  // user just signs in their own wallet (non-custodial).
  const dlSide = searchParams.get('side')
  const dlAmount = searchParams.get('amount')
  const wantsTrade = searchParams.get('action') === 'trade' || dlSide != null || dlAmount != null
  const tradeRef = useRef(null)
  const [flash, setFlash] = useState(false)

  // A brand-new coin (or a deep link before the feed loads) may not be in the
  // in-memory feed yet. Fetch it directly from the launched-here registry so the
  // page always resolves instead of showing "Agent not found".
  const [fallback, setFallback] = useState(null)
  const [fetching, setFetching] = useState(false)
  const [shared, setShared] = useState(false)
  useEffect(() => {
    if (feedCharm || fallback) return
    let cancelled = false
    setFetching(true)
    const isAddr = /^0x[a-fA-F0-9]{40}$/.test(String(id))
    // Not a launched-here coin, but a valid address - read its real symbol/name
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

  // Once the coin resolves, bring the (pre-filled) swap into view and flash it.
  useEffect(() => {
    if (!charm || !wantsTrade || !tradeRef.current) return
    const el = tradeRef.current
    const t = setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setFlash(true)
      setTimeout(() => setFlash(false), 1600)
    }, 250)
    return () => clearTimeout(t)
  }, [charm, wantsTrade])

  if (!charm) {
    return (
      <div className="text-center py-20 text-[var(--color-ink-soft)]">
        {agentsLoading || fetching ? tr('common.loadingAgent', 'Loading agent…') : <>{tr('chat.notFound', 'Agent not found.')} <Link className="underline" to="/">{tr('launch.backToDiscover', 'Back to Discover')}</Link></>}
      </div>
    )
  }

  const price = prices[charm.id] ?? charm.price
  const grad = charm.graduated
  const addr = charm.token

  // Share = copy the coin's link. Uses the native share sheet when available,
  // otherwise copies to the clipboard. No third-party (X) involved.
  const shareCoin = async () => {
    const url = `${typeof window !== 'undefined' ? window.location.origin : 'https://aurn.fun'}/c/${addr || charm.id}`
    try {
      if (navigator.share) { await navigator.share({ title: charm.name, text: `$${charm.ticker} on AURN`, url }) }
      else { await navigator.clipboard.writeText(url); setShared(true); setTimeout(() => setShared(false), 1500) }
    } catch { /* user dismissed the share sheet */ }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
        <Back size={15} /> {tr('common.discover', 'Discover')}
      </Link>

      {/* header */}
      <div className="card p-6">
        <div className="flex items-start gap-4">
          <CharmAvatar charm={charm} size={68} ring />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-serif text-3xl">{charm.name}</h1>
              <Verified size={16} gold={charm.official} />
              <span className="font-mono text-sm text-[var(--color-ink-faint)]">${charm.ticker}</span>
              {grad === true && <span className="chip chip-up">{tr('charm.graduated', 'Graduated')}</span>}
            </div>
            <div className="flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)] mt-1 flex-wrap">
              <span>Robinhood Chain</span>
              {addr && <><span className="opacity-40">·</span><CopyCA addr={addr} /></>}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              {charm.vibe.map((v) => <span key={v} className="chip">{v}</span>)}
              <SocialLinks socials={charm.socials} />
            </div>
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <Link to={`/chat/${charm.id}`} className="btn btn-primary flex-1 justify-center">{tr('charm.chatWith', 'Chat with {name}').replace('{name}', charm.name)}</Link>
          <button onClick={shareCoin} title="Copy link" className="btn btn-secondary shrink-0 inline-flex items-center gap-1.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>
            {shared ? tr('common.copied', 'Copied') : tr('action.share', 'Share')}
          </button>
        </div>
      </div>

      {/* creator fees - only shown to the wallet that launched this coin */}
      {addr && <CreatorFees token={addr} symbol={charm.ticker} />}

      {/* about */}
      <div className="card p-6">
        <div className="eyebrow mb-2">{tr('charm.about', 'About')}</div>
        <p className="text-[var(--color-ink)] leading-relaxed">{charm.lore}</p>
      </div>

      {/* trade - pons-style */}
      <div ref={tradeRef} className={`rounded-2xl transition-shadow duration-700 ${flash ? 'ring-2 ring-[var(--color-accent)] ring-offset-2 ring-offset-[var(--color-paper)]' : ''}`}>
        <TradePanel token={addr} symbol={charm.ticker} initialSide={dlSide} initialAmount={dlAmount} />
      </div>

      {/* price + chart */}
      <div className="card p-6">
        <div className="flex items-end justify-between mb-5">
          <div>
            <div className="eyebrow mb-1">{tr('market.price', 'Price')}</div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="font-mono num text-3xl font-semibold">{price ? usd(price) : '-'}</div>
              {charm.change24 != null && (
                <span className={`chip !text-sm ${charm.change24 >= 0 ? 'chip-up' : 'chip-down'}`}>{pct(charm.change24)} · 24h</span>
              )}
            </div>
          </div>
        </div>
        <PriceChart seed={charm.history} live={price} up={charm.change24 == null ? true : charm.change24 >= 0} />
        <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t hairline">
          <Stat label={tr('market.marketCap', 'Market cap')} value={charm.mcap ? usd(charm.mcap) : '-'} />
          <Stat label={tr('market.holders', 'Holders')} value={charm.holders != null ? num(charm.holders) : '-'} />
          <Stat label={tr('market.supply', 'Supply')} value={num(charm.supply)} />
        </div>
        {explorer && addr && (
          <a href={`${explorer}/token/${addr}`} target="_blank" rel="noopener noreferrer"
            className="inline-block mt-4 text-xs text-[var(--color-accent)] hover:underline">{tr('charm.viewExplorer', 'View on explorer')} ↗</a>
        )}
      </div>
    </div>
  )
}

/* Small X / Telegram / website links, from the coin's on-chain socials. */
function SocialLinks({ socials }) {
  if (!socials) return null
  const tw = socials.twitter?.trim()
  const tg = socials.telegram?.trim()
  const web = socials.website?.trim()
  const twUrl = tw ? (tw.startsWith('http') ? tw : `https://x.com/${tw.replace(/^@/, '')}`) : null
  const tgUrl = tg ? (tg.startsWith('http') ? tg : `https://t.me/${tg.replace(/^@/, '')}`) : null
  const webUrl = web ? (web.startsWith('http') ? web : `https://${web}`) : null
  if (!twUrl && !tgUrl && !webUrl) return null
  const cls = 'chip inline-flex items-center gap-1 hover:text-[var(--color-ink)] hover:border-[var(--color-line-2)] transition'
  return (
    <>
      {twUrl && (
        <a href={twUrl} target="_blank" rel="noopener noreferrer" className={cls} title="X">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M18.9 2H22l-7.5 8.6L23 22h-6.8l-5.3-6.9L4.8 22H1.7l8-9.2L1 2h7l4.8 6.3L18.9 2Zm-1.2 18h1.9L6.4 4H4.4l13.3 16Z" /></svg>
          X
        </a>
      )}
      {tgUrl && (
        <a href={tgUrl} target="_blank" rel="noopener noreferrer" className={cls} title="Telegram">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M21.9 4.3 18.6 20c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2L6.7 13 1.9 11.5c-1-.3-1-1 .2-1.5L20.6 2.9c.9-.3 1.6.2 1.3 1.4Z" /></svg>
          TG
        </a>
      )}
      {webUrl && (
        <a href={webUrl} target="_blank" rel="noopener noreferrer" className={cls} title="Website">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></svg>
          Site
        </a>
      )}
    </>
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
