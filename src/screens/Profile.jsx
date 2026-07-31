import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Gear, XGlyph, Coin, Verified } from '../components/icons'
import CharmAvatar from '../components/CharmAvatar'
import WalletActions from '../components/WalletActions'
import { primeHoldings, cachedHoldings } from '../lib/holdings'

/**
 * Portfolio — real, on-chain.
 *
 * Everything here is read from the wallet minted for your X account: the ETH
 * balance and every coin it holds, priced live. The `portfolio` command's own
 * endpoint (/api/terminal) is the single source, so the numbers here and in the
 * terminal can never disagree.
 */

const NETWORK = 'robinhood'
const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')

/** Never show a raw RPC/SSL stack trace — translate it to something a human reads. */
function friendly(msg) {
  const s = String(msg || '')
  if (/SSL|EPROTO|handshake|allowlist|403|ECONN|ENOTFOUND|timeout|fetch|network|unreachable|502|server response/i.test(s)) {
    return "Couldn't reach Robinhood Chain right now — the RPC is unavailable. Tap Refresh in a moment."
  }
  return s
}
const fmtUsd = (n) =>
  n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })
const fmtEth = (n) =>
  n == null ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 6 }) + ' ETH'
const fmtQty = (n) =>
  Number(n).toLocaleString('en-US', { maximumFractionDigits: n >= 1 ? 2 : 6 })
const fmtPct = (n) => (n == null ? null : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`)
const fmtSignedUsd = (n) =>
  n == null ? null : `${n >= 0 ? '+' : '−'}$${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`

export default function Profile() {
  const nav = useNavigate()
  const { wallet, connect, ethUsd: storeEthUsd, agents } = useStore()

  // The live feed carries each coin's real 24h change and logo. Match holdings
  // to it by address so the portfolio can show a coloured +/- and a proper icon.
  const feedByToken = useMemo(() => {
    const m = new Map()
    for (const a of agents) m.set((a.token || a.id || '').toLowerCase(), a)
    return m
  }, [agents])

  const [folio, setFolio] = useState(null)
  // Holdings we already read (this or a previous session) paint instantly while
  // the fresh scan runs — so the list never sits on "Reading your wallet…".
  const [seed] = useState(() => cachedHoldings())
  const [folioEthUsd, setFolioEthUsd] = useState(null)
  const [walletEth, setWalletEth] = useState(null)
  const [address, setAddress] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    if (!wallet) return
    setError(null)

    // Fast path — the balance is one getBalance call and must paint immediately,
    // not wait behind the heavy holdings scan (which times out on a public RPC).
    fetch(`/api/wallet?network=${NETWORK}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((w) => {
        if (w?.address) setAddress(w.address)
        if (w?.balance?.formatted != null) setWalletEth(Number(w.balance.formatted))
      })
      .catch(() => {})

    // Slower path — every coin the wallet holds, priced.
    setLoading(true)
    try {
      const res = await fetch('/api/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: 'portfolio', network: NETWORK }),
      })
      const json = await res.json()
      if (json.data) {
        setFolio(json.data)
        setFolioEthUsd(json.ethUsd ?? null)
        if (json.data.address) setAddress(json.data.address)
        primeHoldings(json.data.holdings || []) // warm the Send/Trade pickers
      }
    } catch {
      /* the balance above still shows; holdings just stay empty */
    } finally {
      setLoading(false)
    }
  }, [wallet])

  useEffect(() => { load() }, [load])

  const copyAddr = useCallback(async () => {
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {}
  }, [address])

  if (!wallet) {
    return (
      <div className="max-w-md mx-auto text-center py-24">
        <div className="orb-spin mx-auto mb-6 w-14 h-14 rounded-2xl grid place-items-center" style={{ background: 'var(--holo)' }}><XGlyph size={20} color="#0b0a12" /></div>
        <h1 className="font-serif text-3xl mb-2">Your portfolio</h1>
        <p className="text-[var(--color-ink-soft)] mb-7">Sign in with X to see the wallet minted for your account, its balance and every coin it holds.</p>
        <button onClick={connect} className="btn btn-primary mx-auto">Sign in with <XGlyph size={13} color="#fff" /></button>
      </div>
    )
  }

  const rate = folioEthUsd ?? storeEthUsd
  // Prefer the balance the store already fetched (instant) over the slower paths.
  const eth = walletEth ?? wallet?.ethBalance ?? folio?.eth ?? null
  const totalWeth = folio?.totalWeth ?? eth
  const totalUsd = totalWeth != null && rate ? totalWeth * rate : null
  const holdings = folio?.holdings ?? seed ?? []
  const haveHoldings = Boolean(folio || seed)

  // Portfolio 24h PnL, summed over the coins we can price a 24h change for.
  // Each coin's value 24h ago is value / (1 + change%/100); the delta is the
  // unrealised move over the day. ETH is excluded (no per-day rate here).
  const pnl = useMemo(() => {
    let now = 0, then = 0
    for (const h of holdings) {
      const feed = feedByToken.get((h.token || '').toLowerCase())
      const ch = feed && Number.isFinite(feed.change24) ? feed.change24 : null
      const v = h.valueUsd ?? (h.valueWeth != null && rate ? h.valueWeth * rate : null)
      if (ch == null || v == null) continue
      const prev = v / (1 + ch / 100)
      now += v; then += prev
    }
    if (then <= 0) return null
    return { pct: (now / then - 1) * 100, usd: now - then }
  }, [holdings, feedByToken, rate])

  return (
    <div className="max-w-3xl mx-auto">
      {/* header — real X identity */}
      <div className="flex items-center gap-3 mb-6">
        {wallet.avatar ? (
          <img src={wallet.avatar} alt="" className="w-12 h-12 rounded-full object-cover border hairline shrink-0" />
        ) : (
          <span className="orb-spin w-12 h-12 rounded-full grid place-items-center font-bold text-xl shrink-0"
            style={{ background: 'var(--holo)', color: '#0b0a12' }}>{(wallet.handle?.replace(/^@/, '')[0] || 'Y').toUpperCase()}</span>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-lg leading-tight truncate">{wallet.name || wallet.handle}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-sm text-[var(--color-ink-soft)] truncate">{wallet.handle}</span>
            <span className="inline-flex items-center gap-1 text-xs text-[var(--color-ink-soft)] shrink-0"><Verified size={13} /> Verified</span>
          </div>
        </div>
        <button onClick={() => nav('/settings')} className="grid place-items-center w-10 h-10 rounded-lg border hairline hover:bg-[var(--color-paper-2)] shrink-0"><Gear size={18} /></button>
      </div>

      {/* real wallet balance card */}
      <div className="card p-5 sm:p-6 mb-4">
        <div className="eyebrow mb-1">Total value</div>
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1">
          <div className="font-mono num text-3xl sm:text-4xl font-semibold">{totalUsd != null ? fmtUsd(totalUsd) : '—'}</div>
          {pnl && (
            <span className={`inline-flex items-baseline gap-1.5 chip !text-sm ${pnl.pct >= 0 ? 'chip-up' : 'chip-down'}`}>
              <span className="font-mono num font-semibold">{fmtPct(pnl.pct)}</span>
              <span className="font-mono num opacity-80">{fmtSignedUsd(pnl.usd)}</span>
              <span className="opacity-70">· 24h</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mt-5 pt-5 border-t hairline">
          <Mini label="ETH balance" value={eth != null ? fmtEth(eth) : '—'} sub={rate && eth != null ? fmtUsd(eth * rate) : null} />
          <Mini label="Coins held" value={haveHoldings ? String(holdings.length) : (loading ? '…' : '0')} sub={folio ? `of ${folio.scanned} scanned` : null} />
        </div>

        <div className="mt-5">
          <WalletActions />
        </div>
        <Link to="/launch" className="btn btn-holo static w-full justify-center mt-2">Launch a coin</Link>
      </div>

      {/* holdings — real coins in the wallet */}
      <div className="flex items-center justify-between mb-3">
        <div className="eyebrow">Holdings</div>
        <button onClick={load} disabled={loading} className="text-xs text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">{loading ? 'Reading…' : '↻ Refresh'}</button>
      </div>

      {holdings.length === 0 ? (
        <Empty
          title={loading ? 'Reading your wallet…' : 'No coins held'}
          subtitle={loading ? 'Scanning balances on Robinhood Chain.' : 'Coins you buy or launch will show up here, priced live.'}
          action={!loading && <Link to="/" className="btn btn-primary">Discover coins</Link>}
        />
      ) : (
        <div className="card overflow-hidden">
          {holdings.map((h, i) => {
            const valueUsd = h.valueUsd ?? (h.valueWeth != null && rate ? h.valueWeth * rate : null)
            const feed = feedByToken.get((h.token || '').toLowerCase())
            const ch = feed && Number.isFinite(feed.change24) ? feed.change24 : null
            const sym = (h.symbol || 'TOKEN').replace(/^\$/, '')
            return (
              <Link key={h.token} to={`/c/${h.token}`} className={`flex items-center gap-3 p-3.5 sm:p-4 hover:bg-[var(--color-paper-2)] transition ${i ? 'border-t hairline' : ''}`}>
                {feed
                  ? <CharmAvatar charm={feed} size={38} />
                  : <span className="w-[38px] h-[38px] grid place-items-center rounded-full panel-soft text-[var(--color-ink-soft)] shrink-0"><Coin size={18} /></span>}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{h.name || `$${sym}`}</div>
                  <div className="text-xs text-[var(--color-ink-faint)] font-mono num truncate">{fmtQty(h.qty)} ${sym}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono num font-semibold">
                    {valueUsd != null ? fmtUsd(valueUsd) : h.valueWeth != null ? fmtEth(h.valueWeth) : '—'}
                  </div>
                  {ch != null && (
                    <div className={`text-xs font-mono num ${ch >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}`}>{fmtPct(ch)}</div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <p className="text-[11px] text-[var(--color-ink-faint)] mt-3">
        Coins are discovered by scanning on-chain transfers to your wallet, then reading each balance — launches, stock tokens and airdrops alike. A position from before the scanned window can still be missing; tap Refresh to rescan.
      </p>
    </div>
  )
}

function Mini({ label, value, sub }) {
  return (
    <div>
      <div className="eyebrow mb-1">{label}</div>
      <div className="font-mono num text-lg font-semibold">{value}</div>
      {sub && <div className="text-xs text-[var(--color-ink-faint)] mt-0.5">{sub}</div>}
    </div>
  )
}

function Empty({ title, subtitle, action }) {
  return (
    <div className="card text-center py-14 px-6">
      <div className="mx-auto mb-4 w-12 h-12 rounded-full border-2 border-dashed border-[var(--color-line-2)]" />
      <h3 className="font-serif text-2xl mb-1">{title}</h3>
      <p className="text-[var(--color-ink-soft)] max-w-xs mx-auto mb-5">{subtitle}</p>
      {action}
    </div>
  )
}
