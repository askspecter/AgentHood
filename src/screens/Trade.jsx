import { useCallback, useEffect, useState } from 'react'
import { useStore } from '../lib/store'
import { XGlyph, Back } from '../components/icons'
import { Link, useSearchParams } from 'react-router-dom'

/**
 * Real on-chain trade.
 *
 * Buys and sells a token by address through the pons swap router on Robinhood
 * Chain. Signing in with X mints a server-side wallet, so there is nothing to
 * connect: the quote is read from the live pool (/api/quote) and the swap is
 * signed with the X wallet on the server (/api/terminal/execute).
 */

const NETWORK = 'robinhood'
const SLIPPAGE_OPTIONS = [1, 5, 15]
const isAddr = (t) => /^0x[a-fA-F0-9]{40}$/.test((t || '').trim())
const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')
const friendly = (m) =>
  /SSL|EPROTO|handshake|allowlist|ECONN|ENOTFOUND|timeout|fetch|network|unreachable|502|server response/i.test(String(m || ''))
    ? "Couldn't reach Robinhood Chain right now — the RPC is unavailable. Try again in a moment."
    : String(m || '')

export default function Trade() {
  const { wallet, connect } = useStore()
  const user = wallet ? { username: (wallet.handle || '').replace(/^@/, ''), id: wallet.id } : null
  const [params] = useSearchParams()

  const [meta, setMeta] = useState(null)
  const [metaError, setMetaError] = useState(null)

  const [token, setToken] = useState(params.get('token') || '')
  const [side, setSide] = useState('buy')
  const [amount, setAmount] = useState('')
  const [slippage, setSlippage] = useState(5)

  const [quote, setQuote] = useState(null)
  const [quoting, setQuoting] = useState(false)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)

  const [ethBalance, setEthBalance] = useState(null)
  const [tokBalance, setTokBalance] = useState(null)

  useEffect(() => {
    fetch(`/api/factory?network=${NETWORK}`)
      .then((r) => r.json())
      .then((json) => (json.error ? setMetaError(json.error) : setMeta(json)))
      .catch(() => setMetaError('Could not load router configuration.'))
  }, [])

  // The X wallet's native balance, refreshed after each trade.
  useEffect(() => {
    if (!user) { setEthBalance(null); return }
    let cancelled = false
    fetch(`/api/wallet?network=${NETWORK}`)
      .then((r) => r.json())
      .then((json) => { if (!cancelled && json?.balance) setEthBalance(Number(json.balance.formatted)) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user, done])

  // The token's balance, for the sell side and a "you hold" hint.
  useEffect(() => {
    const t = token.trim()
    if (!user || !isAddr(t)) { setTokBalance(null); return }
    let cancelled = false
    fetch(`/api/wallet?network=${NETWORK}&token=${t}`)
      .then((r) => r.json())
      .then((json) => { if (!cancelled) setTokBalance(json?.token || null) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [token, user, done])

  const getQuote = useCallback(async () => {
    setError(null)
    if (!isAddr(token) || !amount || Number(amount) <= 0) { setQuote(null); return }
    setQuoting(true)
    try {
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim(), side, amount, network: NETWORK, slippage }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Could not quote this trade.'); setQuote(null) }
      else setQuote(json)
    } catch {
      setError('Could not reach the quote endpoint.')
    } finally {
      setQuoting(false)
    }
  }, [token, amount, side, slippage])

  // Auto-quote (debounced) the moment there is a token and an amount.
  useEffect(() => {
    if (!isAddr(token) || !amount || Number(amount) <= 0) { setQuote(null); return }
    const id = setTimeout(() => getQuote(), 450)
    return () => clearTimeout(id)
  }, [token, amount, side, slippage, getQuote])

  const setMax = useCallback(() => {
    if (side === 'buy') {
      if (ethBalance == null) return
      const spendable = Math.max(0, ethBalance - 0.0002) // leave gas
      setAmount(spendable > 0 ? String(spendable) : '')
    } else {
      if (!tokBalance?.formatted) return
      setAmount(tokBalance.formatted)
    }
  }, [side, ethBalance, tokBalance])

  const doTrade = useCallback(async () => {
    if (!user || !quote) return
    setBusy(true); setError(null); setDone(null)
    setStatus('Signing with your X wallet…')
    try {
      const res = await fetch('/api/terminal/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token.trim(),
          side,
          amountInRaw: quote.amountInRaw,
          expectedOutRaw: quote.amountOutRaw,
          slippage,
          network: NETWORK,
        }),
      })
      const json = await res.json()
      if (!res.ok) setError(json.hint ? `${json.error} ${json.hint}` : json.error || 'The trade failed.')
      else setDone({ hash: json.hash })
      setStatus(null)
    } catch {
      setError('Could not reach the execute endpoint.'); setStatus(null)
    } finally {
      setBusy(false)
    }
  }, [user, quote, token, side, slippage])

  return (
    <div className="max-w-lg mx-auto">
      <Link to="/" className="btn btn-secondary mb-5"><Back size={15} /> Discover</Link>

      <h1 className="font-serif text-3xl mb-1">Trade a coin</h1>
      <p className="text-[var(--color-ink-soft)] mb-6 text-sm">
        Real swaps through the pons router on Robinhood Chain, quoted live and signed by your X
        wallet. Paste any token contract address.
      </p>

      <div className="card p-5">
        {metaError && <div className="chip chip-down w-full mb-4">{friendly(metaError)}</div>}

        {user ? (
          <div className="flex items-center gap-2 text-sm text-[var(--color-ink-soft)] mb-4">
            <span className="w-2 h-2 rounded-full bg-[var(--color-up)]" /> Trading with your X wallet · @{user.username}
          </div>
        ) : (
          <button onClick={connect} className="btn btn-holo w-full mb-4">
            Sign in with <XGlyph size={13} color="#0b0a12" /> to trade
          </button>
        )}

        <div className="seg mb-4">
          {['buy', 'sell'].map((s) => (
            <button key={s} className={side === s ? 'on' : ''} onClick={() => { setSide(s); setQuote(null) }}>
              {s[0].toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <label className="block mb-3">
          <span className="text-xs text-[var(--color-ink-soft)]">Token address</span>
          <input className="input mt-1" placeholder="0x… token contract address" spellCheck={false}
            value={token} onChange={(e) => { setToken(e.target.value); setQuote(null) }} />
        </label>

        <label className="block mb-4">
          <span className="text-xs text-[var(--color-ink-soft)] flex items-center justify-between">
            <span>Amount {side === 'buy' ? '(ETH to spend)' : '(tokens to sell)'}</span>
            {user && (
              <span className="flex items-center gap-2">
                {side === 'buy'
                  ? ethBalance != null && `Bal: ${ethBalance.toLocaleString('en-US', { maximumFractionDigits: 6 })} ETH`
                  : tokBalance && `Bal: ${Number(tokBalance.formatted).toLocaleString('en-US', { maximumFractionDigits: 4 })} $${(tokBalance.symbol || 'TOKEN').replace(/^\$/, '')}`}
                {((side === 'buy' && ethBalance != null) || (side === 'sell' && tokBalance)) && (
                  <button type="button" className="text-[var(--color-accent)] font-medium" onClick={setMax}>MAX</button>
                )}
              </span>
            )}
          </span>
          <input className="input mt-1" placeholder={side === 'buy' ? '0.05' : '1000000'} spellCheck={false}
            value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>

        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-[var(--color-ink-soft)] mr-1">Max slippage</span>
          {SLIPPAGE_OPTIONS.map((s) => (
            <button key={s} className={`chip ${slippage === s ? 'chip-up' : ''}`} onClick={() => { setSlippage(s); setQuote(null) }}>{s}%</button>
          ))}
        </div>

        <button className="btn btn-primary w-full" onClick={doTrade} disabled={busy || !user || !quote || quoting}>
          {busy ? 'Working…' : quoting ? 'Pricing…' : side === 'buy' ? 'Buy' : 'Sell'}
        </button>

        {quote && (
          <div className="grid grid-cols-3 gap-2 mt-4 text-center">
            <div className="card p-3"><div className="text-[10px] text-[var(--color-ink-faint)] uppercase">You pay</div><div className="text-sm font-medium mt-1">{quote.amountInLabel}</div></div>
            <div className="card p-3"><div className="text-[10px] text-[var(--color-ink-faint)] uppercase">Receive (est.)</div><div className="text-sm font-medium mt-1">{quote.amountOutLabel}</div></div>
            <div className="card p-3"><div className="text-[10px] text-[var(--color-ink-faint)] uppercase">Min out</div><div className="text-sm font-medium mt-1">{quote.minOutLabel || '—'}</div></div>
          </div>
        )}

        {status && <div className="chip w-full mt-4">{status}</div>}
        {error && <div className="chip chip-down w-full mt-4">{friendly(error)}</div>}
        {done && (
          <div className="chip chip-up w-full mt-4">
            Swap confirmed.{' '}
            {meta?.explorer && (
              <a href={`${meta.explorer}/tx/${done.hash}`} target="_blank" rel="noopener noreferrer" className="underline">View transaction ↗</a>
            )}
          </div>
        )}
      </div>

      {meta?.swapRouter && (
        <p className="text-[11px] text-center text-[var(--color-ink-faint)] mt-3">
          Router {short(meta.swapRouter)} · {meta.poolFee / 10_000}% fee · non-custodial via your X wallet
        </p>
      )}
    </div>
  )
}
