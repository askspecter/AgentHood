import { useCallback, useEffect, useState } from 'react'
import { useStore } from '../lib/store'
import { XGlyph } from './icons'

/**
 * pons-style inline swap.
 *
 * A Sell box over a Buy box with a flip control between them, percentage
 * shortcuts, a slippage adjuster and one action button — the same shape as the
 * pons trade sheet. All real: live quote (/api/quote), balances (/api/wallet),
 * and execution signed by the X wallet (/api/terminal/execute).
 */

const NETWORK = 'robinhood'
const SLIPPAGE_OPTIONS = [1, 5, 15]
const isAddr = (t) => /^0x[a-fA-F0-9]{40}$/.test((t || '').trim())
const friendly = (m) =>
  /SSL|EPROTO|handshake|allowlist|ECONN|ENOTFOUND|timeout|fetch|network|unreachable|502|server response/i.test(String(m || ''))
    ? '' : String(m || '')

function EthMark({ size = 22 }) {
  return (
    <span className="grid place-items-center rounded-full" style={{ width: size, height: size, background: '#627eea' }}>
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="#fff"><path d="M12 2l6 10-6 3.5L6 12z" opacity=".9" /><path d="M12 16.5L18 13l-6 9-6-9z" opacity=".65" /></svg>
    </span>
  )
}

export default function TradePanel({ token, symbol = 'TOKEN', name, logo, editableToken = false, bare = false }) {
  const { wallet, connect } = useStore()
  const user = wallet ? { username: (wallet.handle || '').replace(/^@/, '') } : null

  const [tok, setTok] = useState(token || '')
  useEffect(() => { if (token) setTok(token) }, [token])

  const [meta, setMeta] = useState(null)
  const [side, setSide] = useState('buy')
  const [amount, setAmount] = useState('')
  const [slippage, setSlippage] = useState(1)

  const [quote, setQuote] = useState(null)
  const [quoting, setQuoting] = useState(false)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)

  const [ethBalance, setEthBalance] = useState(null)
  const [tokBalance, setTokBalance] = useState(null)

  const tradeable = isAddr(tok)

  useEffect(() => {
    fetch(`/api/factory?network=${NETWORK}`).then((r) => r.json()).then((j) => !j.error && setMeta(j)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!user) { setEthBalance(null); return }
    let c = false
    fetch(`/api/wallet?network=${NETWORK}`).then((r) => r.json()).then((j) => { if (!c && j?.balance) setEthBalance(Number(j.balance.formatted)) }).catch(() => {})
    return () => { c = true }
  }, [user, done])

  useEffect(() => {
    if (!user || !tradeable) { setTokBalance(null); return }
    let c = false
    fetch(`/api/wallet?network=${NETWORK}&token=${tok}`).then((r) => r.json()).then((j) => { if (!c) setTokBalance(j?.token || null) }).catch(() => {})
    return () => { c = true }
  }, [tok, user, tradeable, done])

  const getQuote = useCallback(async () => {
    setError(null)
    if (!tradeable || !amount || Number(amount) <= 0) { setQuote(null); return }
    setQuoting(true)
    try {
      const res = await fetch('/api/quote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tok, side, amount, network: NETWORK, slippage }),
      })
      const j = await res.json()
      if (!res.ok) { setError(friendly(j.error)); setQuote(null) } else setQuote(j)
    } catch { setError('') } finally { setQuoting(false) }
  }, [tok, tradeable, amount, side, slippage])

  useEffect(() => {
    if (!tradeable || !amount || Number(amount) <= 0) { setQuote(null); return }
    const id = setTimeout(getQuote, 450)
    return () => clearTimeout(id)
  }, [amount, side, slippage, tradeable, getQuote])

  const sellIsEth = side === 'buy'
  const sellAvail = sellIsEth ? ethBalance : (tokBalance?.formatted != null ? Number(tokBalance.formatted) : null)
  const setPctOf = (p) => {
    if (sellAvail == null) return
    let v = sellAvail * p
    if (sellIsEth) v = Math.max(0, v - 0.0002) // gas headroom
    setAmount(v > 0 ? String(+v.toFixed(sellIsEth ? 6 : 4)) : '')
  }

  const doTrade = useCallback(async () => {
    if (!user) return connect()
    if (!quote || !tradeable) return
    setBusy(true); setError(null); setDone(null); setStatus('Signing with your X wallet…')
    try {
      const res = await fetch('/api/terminal/execute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tok, side, amountInRaw: quote.amountInRaw, expectedOutRaw: quote.amountOutRaw, slippage, network: NETWORK }),
      })
      const j = await res.json()
      if (!res.ok) setError(friendly(j.hint ? `${j.error} ${j.hint}` : j.error) || 'The trade failed.')
      else setDone({ hash: j.hash })
      setStatus(null)
    } catch { setError('The trade failed.'); setStatus(null) } finally { setBusy(false) }
  }, [user, quote, tradeable, tok, side, slippage])

  const sym = (quote?.symbol || symbol || 'TOKEN').replace(/^\$/, '')
  const outLabel = quote ? quote.amountOutLabel : '0'
  const sellChip = sellIsEth
    ? <><EthMark /> <span className="font-semibold">ETH</span></>
    : <><Logo logo={logo} sym={sym} /> <span className="font-semibold">{sym}</span></>
  const buyChip = sellIsEth
    ? <><Logo logo={logo} sym={sym} /> <span className="font-semibold">{sym}</span></>
    : <><EthMark /> <span className="font-semibold">ETH</span></>
  const sellAvailLabel = sellIsEth
    ? (ethBalance != null ? `ETH ${ethBalance.toLocaleString('en-US', { maximumFractionDigits: 6 })} available` : 'ETH — available')
    : (tokBalance ? `${Number(tokBalance.formatted).toLocaleString('en-US', { maximumFractionDigits: 4 })} available` : `${sym} — available`)

  return (
    <div className={bare ? '' : 'card p-4'}>
      {editableToken && (
        <label className="block mb-3">
          <span className="text-xs text-[var(--color-ink-soft)]">Token address</span>
          <input value={tok} onChange={(e) => { setTok(e.target.value.trim()); setQuote(null) }}
            placeholder="0x… paste a coin to trade" spellCheck={false} className="input mt-1" />
        </label>
      )}
      {/* Sell box */}
      <div className="rounded-2xl p-3 bg-[var(--color-paper-2)]">
        <div className="text-sm text-[var(--color-ink-soft)] mb-0.5">Sell</div>
        <input
          value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
          placeholder="0" inputMode="decimal"
          className="w-full bg-transparent outline-none text-2xl font-bold tracking-tight placeholder:text-[var(--color-ink-faint)]" />
        <div className="text-xs text-[var(--color-ink-faint)] mt-0.5">{quote && sellIsEth === (side === 'buy') ? quote.amountInLabel?.replace(/^[\d.,]+\s*/, '') && `≈ ${quote.amountInLabel}` : '$0.00'}</div>
        <div className="flex items-center justify-between mt-2">
          <span className="inline-flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border hairline">{sellChip}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-ink-soft)]">{sellAvailLabel}</span>
            <button onClick={() => setPctOf(1)} className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: 'var(--holo)', color: '#0b0a12' }}>Max</button>
          </div>
        </div>
      </div>

      {/* flip */}
      <div className="relative h-0">
        <button onClick={() => { setSide((s) => (s === 'buy' ? 'sell' : 'buy')); setAmount(''); setQuote(null) }}
          aria-label="Flip"
          className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 top-0 z-10 grid place-items-center w-10 h-10 rounded-xl border hairline bg-[var(--color-paper)] hover:bg-[var(--color-paper-2)]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4v16l-3-3M17 20V4l3 3" /></svg>
        </button>
      </div>

      {/* Buy box */}
      <div className="rounded-2xl p-3 bg-[var(--color-paper-2)] mt-1.5">
        <div className="text-sm text-[var(--color-ink-soft)] mb-0.5">Buy</div>
        <div className="text-2xl font-bold tracking-tight truncate">{quoting ? '…' : (outLabel?.replace(/\s*[A-Za-z$].*$/, '') || '0')}</div>
        <div className="text-sm text-[var(--color-ink-faint)] mt-1">$0.00</div>
        <div className="flex items-center justify-between mt-3">
          <span className="inline-flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border hairline">{buyChip}</span>
        </div>
      </div>

      {/* percentages */}
      <div className="grid grid-cols-4 gap-2 mt-3">
        {[0.25, 0.5, 0.75, 1].map((p) => (
          <button key={p} onClick={() => setPctOf(p)} className="py-2 rounded-full border hairline text-sm hover:bg-[var(--color-paper-2)]">{p * 100}%</button>
        ))}
      </div>

      {/* slippage */}
      <div className="flex items-center justify-between mt-3">
        <span className="text-[var(--color-ink-soft)]">Slippage</span>
        <button onClick={() => setSlippage((s) => SLIPPAGE_OPTIONS[(SLIPPAGE_OPTIONS.indexOf(s) + 1) % SLIPPAGE_OPTIONS.length])}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border hairline text-sm">
          {slippage}% <span className="text-[var(--color-ink-soft)]">⚙ Adjust</span>
        </button>
      </div>

      {/* action */}
      <button onClick={doTrade} disabled={busy || quoting || (user && (!quote || !tradeable))}
        className="btn btn-holo static w-full !py-3 mt-3">
        {busy ? 'Working…' : !user ? <>Sign in with <XGlyph size={13} color="#0b0a12" /></> : quoting ? 'Pricing…' : !amount || Number(amount) <= 0 ? 'Enter amount' : side === 'buy' ? `Buy ${sym}` : `Sell ${sym}`}
      </button>

      {error && <div className="chip chip-down w-full mt-3">{error}</div>}
      {status && <div className="chip w-full mt-3">{status}</div>}
      {done && (
        <div className="chip chip-up w-full mt-3">
          Swap confirmed. {meta?.explorer && <a href={`${meta.explorer}/tx/${done.hash}`} target="_blank" rel="noopener noreferrer" className="underline">View ↗</a>}
        </div>
      )}
    </div>
  )
}

function Logo({ logo, sym }) {
  if (logo) return <img src={logo} alt="" className="w-[22px] h-[22px] rounded-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />
  return <span className="w-[22px] h-[22px] rounded-full grid place-items-center text-[11px] font-bold" style={{ background: 'var(--holo)', color: '#0b0a12' }}>{(sym || '?')[0]}</span>
}
