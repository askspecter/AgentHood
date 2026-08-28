import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import CharmAvatar from '../components/CharmAvatar'
import { Back } from '../components/icons'
import { DURATIONS, getLocks, addLock, removeLock, fmtCountdown, fmtDate } from '../lib/locks'

/**
 * Settings → Locked. Lock supply of a token you hold on Robinhood Chain for a
 * fixed term, and watch each lock count down to unlock.
 *
 * AURN is non-custodial, so this records your lock against your connected wallet
 * in the app. When a locker contract is wired for Robinhood Chain, the same flow
 * signs a real on-chain time-lock — nothing here ever holds your keys.
 */

const NETWORK = 'robinhood'
const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')
const isAddr = (s) => /^0x[a-fA-F0-9]{40}$/.test(String(s || '').trim())

export default function Locked() {
  const nav = useNavigate()
  const { wallet, connect, agents } = useStore()

  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const [locks, setLocks] = useState([])
  const refresh = useCallback(() => setLocks(wallet ? getLocks(wallet.address) : []), [wallet])
  useEffect(() => { refresh() }, [refresh])

  // Token selection + its live balance for the connected wallet.
  const [picker, setPicker] = useState(false)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(null) // { token, symbol, name, logo, decimals, balance }
  const [balBusy, setBalBusy] = useState(false)
  const [amount, setAmount] = useState('')
  const [dur, setDur] = useState('1mo')
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return agents
      .filter((a) => a.token || a.id)
      .filter((a) => !needle || a.name?.toLowerCase().includes(needle) || a.ticker?.toLowerCase().includes(needle) || String(a.token || a.id).toLowerCase().includes(needle))
      .slice(0, 40)
  }, [agents, q])

  // Read the connected wallet's balance of a token (public on-chain read).
  const reqRef = useRef(0)
  const readBalance = useCallback(async (token) => {
    if (!wallet?.address || !isAddr(token)) return
    const id = ++reqRef.current
    setBalBusy(true)
    try {
      const r = await fetch(`/api/wallet?network=${NETWORK}&address=${wallet.address}&token=${token}`)
      const j = await r.json()
      if (id !== reqRef.current) return
      const t = j?.token
      setSel((s) => (s && s.token?.toLowerCase() === token.toLowerCase()
        ? { ...s, balance: t?.formatted ?? null, decimals: t?.decimals ?? s.decimals, symbol: t?.symbol || s.symbol, name: t?.name || s.name }
        : s))
    } catch { /* leave balance null */ } finally {
      if (id === reqRef.current) setBalBusy(false)
    }
  }, [wallet])

  const pickAgent = (a) => {
    const token = a.token || a.id
    setSel({ token, symbol: a.ticker, name: a.name, logo: a.logo, tone: a.tone, decimals: 18, balance: null })
    setPicker(false); setQ(''); setError(null); setAmount('')
    readBalance(token)
  }
  const pickPasted = () => {
    const token = q.trim()
    if (!isAddr(token)) { setError('Paste a valid token address (0x…).'); return }
    setSel({ token, symbol: short(token), name: 'Token', logo: '', decimals: 18, balance: null })
    setPicker(false); setQ(''); setError(null); setAmount('')
    readBalance(token)
  }

  const setMax = () => { if (sel?.balance != null) setAmount(String(sel.balance)) }

  const canLock = wallet && sel && Number(amount) > 0 &&
    (sel.balance == null || Number(amount) <= Number(sel.balance) + 1e-9)

  const submit = () => {
    setError(null)
    if (!wallet) return connect()
    if (!sel) return setError('Pick a token to lock.')
    const amt = Number(amount)
    if (!(amt > 0)) return setError('Enter an amount to lock.')
    if (sel.balance != null && amt > Number(sel.balance) + 1e-9) return setError(`You only hold ${sel.balance} ${sel.symbol}.`)
    const d = DURATIONS.find((x) => x.key === dur) || DURATIONS[3]
    const startedAt = Date.now()
    addLock(wallet.address, {
      token: sel.token, symbol: sel.symbol, name: sel.name, logo: sel.logo || '', tone: sel.tone,
      amount: String(amount), decimals: sel.decimals ?? 18,
      durationKey: d.key, durationLabel: d.label, startedAt, unlockAt: startedAt + d.ms,
    })
    setSel(null); setAmount(''); setDur('1mo'); setDone(true)
    setTimeout(() => setDone(false), 1800)
    refresh()
  }

  const unlock = (id) => { removeLock(wallet.address, id); refresh() }

  if (!wallet) {
    return (
      <div className="max-w-md mx-auto text-center py-24">
        <h1 className="font-serif text-3xl mb-2">Locked</h1>
        <p className="text-[var(--color-ink-soft)] mb-7">Connect your wallet to lock token supply and track your locks.</p>
        <button onClick={connect} className="btn btn-primary mx-auto">Connect Wallet</button>
      </div>
    )
  }

  const active = locks.filter((l) => l.unlockAt > now)
  const ready = locks.filter((l) => l.unlockAt <= now)

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => nav(-1)} className="grid place-items-center w-10 h-10 rounded-lg border hairline hover:bg-[var(--color-paper-2)]"><Back size={18} /></button>
        <h1 className="font-serif text-3xl">Locked</h1>
      </div>

      {/* New lock */}
      <div className="card p-6 mb-5">
        <div className="font-semibold">Lock token supply</div>
        <p className="text-sm text-[var(--color-ink-soft)] mt-1">
          Lock supply of a token you hold on Robinhood Chain for a fixed term. Your lock and its countdown are recorded to your connected wallet.
        </p>

        {/* token */}
        <div className="eyebrow mt-5 mb-2">Token</div>
        {sel ? (
          <button onClick={() => { setPicker(true); setSel(null) }} className="w-full flex items-center justify-between gap-3 input !py-2.5">
            <span className="flex items-center gap-2.5 min-w-0">
              <TokenLogo sel={sel} size={28} />
              <span className="min-w-0 text-left">
                <span className="font-medium">{sel.symbol}</span>
                <span className="text-xs text-[var(--color-ink-faint)] ml-1.5 font-mono">{short(sel.token)}</span>
              </span>
            </span>
            <span className="text-xs text-[var(--color-accent)]">Change</span>
          </button>
        ) : (
          <button onClick={() => setPicker(true)} className="w-full input !py-3 text-left text-[var(--color-ink-soft)]">Select a token…</button>
        )}

        {picker && (
          <div className="mt-2 rounded-xl panel-soft p-2 fade-up">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search AURN coins or paste a token address…" className="input !py-2 mb-2" />
            <div className="max-h-56 overflow-y-auto no-scrollbar divide-y divide-[var(--color-line)]">
              {isAddr(q) && (
                <button onClick={pickPasted} className="w-full flex items-center justify-between gap-3 px-2.5 py-2.5 text-left hover:bg-[var(--color-paper-2)] rounded-lg">
                  <span className="font-mono text-sm truncate">{q.trim()}</span>
                  <span className="text-xs text-[var(--color-accent)] shrink-0">Use address</span>
                </button>
              )}
              {list.map((a) => (
                <button key={a.token || a.id} onClick={() => pickAgent(a)} className="w-full flex items-center gap-2.5 px-2.5 py-2 text-left hover:bg-[var(--color-paper-2)] rounded-lg">
                  <TokenLogo sel={{ logo: a.logo, tone: a.tone, symbol: a.ticker, name: a.name }} size={26} />
                  <span className="min-w-0"><span className="font-medium">{a.name}</span> <span className="text-xs text-[var(--color-ink-faint)] font-mono uppercase">{a.ticker}</span></span>
                </button>
              ))}
              {!list.length && !isAddr(q) && <div className="px-3 py-3 text-sm text-[var(--color-ink-faint)]">No match. Paste a token address to lock any Robinhood Chain token.</div>}
            </div>
          </div>
        )}

        {/* amount */}
        {sel && (
          <>
            <div className="flex items-center justify-between mt-5 mb-2">
              <span className="eyebrow">Amount</span>
              <span className="text-xs text-[var(--color-ink-faint)] font-mono">
                {balBusy ? 'reading…' : sel.balance != null ? `Balance: ${sel.balance} ${sel.symbol}` : 'Balance —'}
              </span>
            </div>
            <div className="flex items-center input !py-2.5">
              <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
                inputMode="decimal" placeholder="0.0" className="flex-1 min-w-0 bg-transparent outline-none border-0 p-0 font-mono num text-lg" />
              <button onClick={setMax} disabled={sel.balance == null} className="chip chip-brand !py-1 shrink-0 disabled:opacity-40">Max</button>
            </div>

            {/* duration */}
            <div className="eyebrow mt-5 mb-2">Lock for</div>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <button key={d.key} onClick={() => setDur(d.key)} className={`chip ${dur === d.key ? 'chip-brand' : 'hover:bg-[var(--color-line)]'}`}>{d.label}</button>
              ))}
            </div>
            <p className="text-[11px] text-[var(--color-ink-faint)] mt-3">
              Unlocks {fmtDate(Date.now() + (DURATIONS.find((x) => x.key === dur)?.ms || 0))}.
            </p>

            {error && <div className="chip chip-down w-full mt-4">{error}</div>}
            <button onClick={submit} disabled={!canLock} className="btn btn-holo w-full !py-3.5 mt-4">
              {done ? 'Locked ✓' : `Lock ${sel.symbol}`}
            </button>
          </>
        )}
        {!sel && error && <div className="chip chip-down w-full mt-4">{error}</div>}
      </div>

      {/* Locked tokens */}
      <div className="eyebrow mb-3">Your locks {locks.length > 0 && <span className="text-[var(--color-ink-faint)] normal-case tracking-normal">· {locks.length}</span>}</div>

      {locks.length === 0 ? (
        <div className="card text-center py-12 text-[var(--color-ink-soft)]">No locked tokens yet. Lock supply above to see it here with a live countdown.</div>
      ) : (
        <div className="space-y-2.5">
          {ready.map((l) => <LockRow key={l.id} lock={l} now={now} onUnlock={() => unlock(l.id)} />)}
          {active.map((l) => <LockRow key={l.id} lock={l} now={now} />)}
        </div>
      )}

      <p className="text-[11px] text-center text-[var(--color-ink-faint)] mt-6">
        Non-custodial — AURN never holds your keys. On-chain time-lock enforcement activates once the locker contract is live on Robinhood Chain.
      </p>
    </div>
  )
}

function TokenLogo({ sel, size = 28 }) {
  const [broken, setBroken] = useState(false)
  if (sel?.logo && !broken) {
    return <img src={sel.logo} alt="" width={size} height={size} onError={() => setBroken(true)}
      className="rounded-lg object-cover shrink-0 bg-[var(--color-paper-2)]" style={{ width: size, height: size }} />
  }
  return <CharmAvatar charm={{ name: sel?.name || sel?.symbol || '?', tone: sel?.tone, ticker: sel?.symbol }} size={size} square />
}

function LockRow({ lock, now, onUnlock }) {
  const remaining = lock.unlockAt - now
  const ready = remaining <= 0
  const total = lock.unlockAt - lock.startedAt
  const pctDone = total > 0 ? Math.min(100, Math.max(0, ((now - lock.startedAt) / total) * 100)) : 100
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <TokenLogo sel={lock} size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate">{lock.symbol}</span>
            <span className="text-xs text-[var(--color-ink-faint)]">· {lock.durationLabel}</span>
          </div>
          <div className="font-mono num text-sm text-[var(--color-ink-soft)]">{lock.amount} <span className="text-[var(--color-ink-faint)]">{lock.symbol}</span></div>
        </div>
        <div className="text-right shrink-0">
          {ready ? (
            <button onClick={onUnlock} className="btn btn-holo !py-2 !px-4 text-sm">Unlock</button>
          ) : (
            <>
              <div className="font-mono num text-sm holo-text font-semibold">{fmtCountdown(remaining)}</div>
              <div className="text-[10px] text-[var(--color-ink-faint)] font-mono">until unlock</div>
            </>
          )}
        </div>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-[rgba(255,255,255,0.08)] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pctDone}%`, background: 'var(--holo-line)' }} />
      </div>
      <div className="flex items-center justify-between mt-2 text-[10px] text-[var(--color-ink-faint)] font-mono">
        <span>Locked {fmtDate(lock.startedAt)}</span>
        <span>{ready ? 'Ready' : fmtDate(lock.unlockAt)}</span>
      </div>
    </div>
  )
}
