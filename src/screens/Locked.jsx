import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from 'wagmi'
import { parseUnits } from 'viem'
import { useStore } from '../lib/store'
import CharmAvatar from '../components/CharmAvatar'
import { Back } from '../components/icons'
import { robinhoodChain, explorerTx } from '../lib/chain'
import { LOCKER_ADDRESS, lockerLive, lockerAbi, erc20ApproveAbi } from '../lib/locker'
import { DURATIONS, getLocks, addLock, removeLock, fmtCountdown, fmtDate } from '../lib/locks'

/**
 * Settings → Locked. Lock supply of a token you hold on Robinhood Chain for a
 * fixed term. When the AurnLocker contract is deployed (NEXT_PUBLIC_LOCKER_ADDRESS),
 * locks are real on-chain time-locks signed by your own wallet, and the list of
 * locked tokens is public — anyone can see it without connecting a wallet.
 */
const NETWORK = 'robinhood'
const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')
const isAddr = (s) => /^0x[a-fA-F0-9]{40}$/.test(String(s || '').trim())

export default function Locked() {
  const nav = useNavigate()
  const { wallet, connect, agents } = useStore()
  const { address, chainId } = useAccount()
  const publicClient = usePublicClient()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()

  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])

  // Public on-chain lock registry (readable without a wallet).
  const [publicLocks, setPublicLocks] = useState(null) // null=loading, []=none
  const loadPublic = useCallback(() => {
    if (!lockerLive) { setPublicLocks([]); return }
    fetch(`/api/locks?network=${NETWORK}`).then((r) => (r.ok ? r.json() : null))
      .then((j) => setPublicLocks(Array.isArray(j?.locks) ? j.locks : []))
      .catch(() => setPublicLocks([]))
  }, [])
  useEffect(() => { loadPublic() }, [loadPublic])

  // Local fallback locks (only used until the contract is deployed).
  const [localLocks, setLocalLocks] = useState([])
  const refreshLocal = useCallback(() => setLocalLocks(wallet ? getLocks(wallet.address) : []), [wallet])
  useEffect(() => { refreshLocal() }, [refreshLocal])

  // Token selection + its live balance for the connected wallet.
  const [picker, setPicker] = useState(false)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(null)
  const [balBusy, setBalBusy] = useState(false)
  const [amount, setAmount] = useState('')
  const [dur, setDur] = useState('1mo')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState('')
  const [doneHash, setDoneHash] = useState(null)

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return agents.filter((a) => a.token || a.id)
      .filter((a) => !needle || a.name?.toLowerCase().includes(needle) || a.ticker?.toLowerCase().includes(needle) || String(a.token || a.id).toLowerCase().includes(needle))
      .slice(0, 40)
  }, [agents, q])

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
    } catch { /* leave balance null */ } finally { if (id === reqRef.current) setBalBusy(false) }
  }, [wallet])

  const pickAgent = (a) => {
    const token = a.token || a.id
    setSel({ token, symbol: a.ticker, name: a.name, logo: a.logo, tone: a.tone, decimals: 18, balance: null })
    setPicker(false); setQ(''); setError(null); setAmount(''); readBalance(token)
  }
  const pickPasted = () => {
    const token = q.trim()
    if (!isAddr(token)) { setError('Paste a valid token address (0x…).'); return }
    setSel({ token, symbol: short(token), name: 'Token', logo: '', decimals: 18, balance: null })
    setPicker(false); setQ(''); setError(null); setAmount(''); readBalance(token)
  }
  const setMax = () => { if (sel?.balance != null) setAmount(String(sel.balance)) }

  const canLock = wallet && sel && Number(amount) > 0 && (sel.balance == null || Number(amount) <= Number(sel.balance) + 1e-9)

  const submit = async () => {
    setError(null); setDoneHash(null)
    if (!wallet) return connect()
    if (!sel) return setError('Pick a token to lock.')
    const amt = Number(amount)
    if (!(amt > 0)) return setError('Enter an amount to lock.')
    if (sel.balance != null && amt > Number(sel.balance) + 1e-9) return setError(`You only hold ${sel.balance} ${sel.symbol}.`)
    const d = DURATIONS.find((x) => x.key === dur) || DURATIONS[3]

    // Fallback: no contract deployed yet — record locally so the flow still works.
    if (!lockerLive) {
      const startedAt = Date.now()
      addLock(wallet.address, { token: sel.token, symbol: sel.symbol, name: sel.name, logo: sel.logo || '', tone: sel.tone, amount: String(amount), decimals: sel.decimals ?? 18, durationKey: d.key, durationLabel: d.label, startedAt, unlockAt: startedAt + d.ms })
      setSel(null); setAmount(''); setDur('1mo'); refreshLocal()
      return
    }

    // On-chain lock: approve (if needed) then lock, signed by the owner's wallet.
    try {
      setBusy(true)
      const decimals = sel.decimals ?? 18
      const amountRaw = parseUnits(String(amount), decimals)
      if (chainId !== robinhoodChain.id) {
        try { await switchChainAsync({ chainId: robinhoodChain.id }) }
        catch { throw new Error(`Switch your wallet to ${robinhoodChain.name} first.`) }
      }
      setStep('Checking approval…')
      const allowance = await publicClient.readContract({ address: sel.token, abi: erc20ApproveAbi, functionName: 'allowance', args: [address, LOCKER_ADDRESS] })
      if (allowance < amountRaw) {
        setStep('Approve the locker…')
        const ah = await writeContractAsync({ address: sel.token, abi: erc20ApproveAbi, functionName: 'approve', args: [LOCKER_ADDRESS, amountRaw], chainId: robinhoodChain.id })
        await publicClient.waitForTransactionReceipt({ hash: ah })
      }
      setStep('Confirm the lock…')
      const unlockAt = BigInt(Math.floor((Date.now() + d.ms) / 1000))
      const hash = await writeContractAsync({ address: LOCKER_ADDRESS, abi: lockerAbi, functionName: 'lock', args: [sel.token, amountRaw, unlockAt], chainId: robinhoodChain.id })
      await publicClient.waitForTransactionReceipt({ hash })
      setDoneHash(hash); setSel(null); setAmount(''); setDur('1mo')
      setTimeout(loadPublic, 2500)
    } catch (err) {
      setError(err?.shortMessage || err?.message?.split('\n')[0] || 'Lock failed.')
    } finally { setBusy(false); setStep('') }
  }

  const unlockLocal = (id) => { removeLock(wallet.address, id); refreshLocal() }
  const unlockChain = async (id) => {
    setError(null)
    try {
      setBusy(true); setStep('Confirm the unlock…')
      if (chainId !== robinhoodChain.id) await switchChainAsync({ chainId: robinhoodChain.id }).catch(() => {})
      const hash = await writeContractAsync({ address: LOCKER_ADDRESS, abi: lockerAbi, functionName: 'unlock', args: [BigInt(id)], chainId: robinhoodChain.id })
      await publicClient.waitForTransactionReceipt({ hash })
      setTimeout(loadPublic, 2500)
    } catch (err) { setError(err?.shortMessage || err?.message?.split('\n')[0] || 'Unlock failed.') }
    finally { setBusy(false); setStep('') }
  }

  // Known AURN coins by token address, so a locked token shows its real logo
  // (from the app's own metadata) even before/without the on-chain read.
  const byToken = useMemo(() => {
    const m = {}
    for (const a of agents) { const t = String(a.token || a.id || '').toLowerCase(); if (t) m[t] = a }
    return m
  }, [agents])
  const withLogo = useCallback((l) => {
    const a = byToken[String(l.token || '').toLowerCase()]
    if (!a) return l
    return { ...l, logo: l.logo || a.logo, tone: l.tone ?? a.tone, symbol: l.symbol || a.ticker, name: l.name || a.name }
  }, [byToken])

  // The list to show as "locked tokens": on-chain public locks (live) or local.
  const allLocks = lockerLive
    ? (publicLocks || []).map((l) => withLogo({ ...l, startedAt: l.lockedAt, durationLabel: '', onchain: true }))
    : localLocks.map((l) => ({ ...l, onchain: false }))
  const mine = address ? allLocks.filter((l) => (l.owner || '').toLowerCase() === address.toLowerCase() || !l.owner) : []

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
          {lockerLive
            ? 'Lock a token you hold on Robinhood Chain for a fixed term. Tokens move into the AurnLocker contract and only you can withdraw them, only after the term ends.'
            : 'Lock a token you hold on Robinhood Chain for a fixed term. Recorded to your wallet until the on-chain locker is set.'}
        </p>

        {!wallet ? (
          <button onClick={connect} className="btn btn-primary w-full mt-5">Connect Wallet to lock</button>
        ) : (
          <>
            <div className="eyebrow mt-5 mb-2">Token</div>
            {sel ? (
              <button onClick={() => { setPicker(true); setSel(null) }} className="w-full flex items-center justify-between gap-3 input !py-2.5">
                <span className="flex items-center gap-2.5 min-w-0">
                  <TokenLogo sel={sel} size={28} />
                  <span className="min-w-0 text-left"><span className="font-medium">{sel.symbol}</span><span className="text-xs text-[var(--color-ink-faint)] ml-1.5 font-mono">{short(sel.token)}</span></span>
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
                      <span className="font-mono text-sm truncate">{q.trim()}</span><span className="text-xs text-[var(--color-accent)] shrink-0">Use address</span>
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

            {sel && (
              <>
                <div className="flex items-center justify-between mt-5 mb-2">
                  <span className="eyebrow">Amount</span>
                  <span className="text-xs text-[var(--color-ink-faint)] font-mono">{balBusy ? 'reading…' : sel.balance != null ? `Balance: ${sel.balance} ${sel.symbol}` : 'Balance —'}</span>
                </div>
                <div className="flex items-center input !py-2.5">
                  <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))} inputMode="decimal" placeholder="0.0" className="flex-1 min-w-0 bg-transparent outline-none border-0 p-0 font-mono num text-lg" />
                  <button onClick={setMax} disabled={sel.balance == null} className="chip chip-brand !py-1 shrink-0 disabled:opacity-40">Max</button>
                </div>

                <div className="eyebrow mt-5 mb-2">Lock for</div>
                <div className="flex flex-wrap gap-2">
                  {DURATIONS.map((d) => (
                    <button key={d.key} onClick={() => setDur(d.key)} className={`chip ${dur === d.key ? 'chip-brand' : 'hover:bg-[var(--color-line)]'}`}>{d.label}</button>
                  ))}
                </div>
                <p className="text-[11px] text-[var(--color-ink-faint)] mt-3">Unlocks {fmtDate(Date.now() + (DURATIONS.find((x) => x.key === dur)?.ms || 0))}.</p>

                {error && <div className="chip chip-down w-full mt-4">{error}</div>}
                {doneHash && <a href={explorerTx(doneHash)} target="_blank" rel="noreferrer" className="mt-3 block text-xs text-center underline text-[var(--color-ink-soft)]">Locked on-chain — view ↗</a>}
                <button onClick={submit} disabled={!canLock || busy} className="btn btn-holo w-full !py-3.5 mt-4">
                  {busy ? (step || 'Working…') : `Lock ${sel.symbol}`}
                </button>
              </>
            )}
            {!sel && error && <div className="chip chip-down w-full mt-4">{error}</div>}
          </>
        )}
      </div>

      {/* Your locks */}
      {address && mine.length > 0 && (
        <>
          <div className="eyebrow mb-3">Your locks <span className="text-[var(--color-ink-faint)] normal-case tracking-normal">· {mine.length}</span></div>
          <div className="space-y-2.5 mb-6">
            {mine.map((l) => (
              <LockRow key={l.id} lock={l} now={now} mine
                onUnlock={l.unlockAt <= now ? () => (l.onchain ? unlockChain(l.id) : unlockLocal(l.id)) : null} />
            ))}
          </div>
        </>
      )}

      {/* Public list — visible to anyone, no wallet needed */}
      <div className="eyebrow mb-3">Locked tokens {lockerLive && publicLocks && <span className="text-[var(--color-ink-faint)] normal-case tracking-normal">· {publicLocks.length} on-chain</span>}</div>
      {!lockerLive ? (
        <div className="card text-center py-10 px-6 text-sm text-[var(--color-ink-soft)]">
          The on-chain locker isn’t deployed yet. Deploy <span className="font-mono">AurnLocker</span> and set <span className="font-mono text-[var(--color-ink)]">NEXT_PUBLIC_LOCKER_ADDRESS</span> — then every lock shows here publicly, no wallet needed.
        </div>
      ) : publicLocks === null ? (
        <div className="card text-center py-10 text-[var(--color-ink-soft)]">Reading the lock registry…</div>
      ) : publicLocks.length === 0 ? (
        <div className="card text-center py-10 text-[var(--color-ink-soft)]">No tokens are locked yet. Be the first — lock supply above.</div>
      ) : (
        <div className="space-y-2.5">
          {publicLocks.map((l) => (
            <LockRow key={l.id} lock={withLogo({ ...l, startedAt: l.lockedAt, durationLabel: '' })} now={now} showOwner />
          ))}
        </div>
      )}

      <p className="text-[11px] text-center text-[var(--color-ink-faint)] mt-6">
        Non-custodial — AURN never holds your keys. {lockerLive ? 'Locks are enforced on-chain by the AurnLocker contract.' : 'On-chain enforcement activates once the locker contract is deployed.'}
      </p>
    </div>
  )
}

function TokenLogo({ sel, size = 28 }) {
  const [broken, setBroken] = useState(false)
  if (sel?.logo && !broken) {
    return <img src={sel.logo} alt="" width={size} height={size} onError={() => setBroken(true)} className="rounded-lg object-cover shrink-0 bg-[var(--color-paper-2)]" style={{ width: size, height: size }} />
  }
  return <CharmAvatar charm={{ name: sel?.name || sel?.symbol || '?', tone: sel?.tone, ticker: sel?.symbol }} size={size} square />
}

function LockRow({ lock, now, onUnlock, mine, showOwner }) {
  const remaining = lock.unlockAt - now
  const ready = remaining <= 0
  const total = (lock.unlockAt - (lock.startedAt || lock.lockedAt)) || 1
  const pctDone = Math.min(100, Math.max(0, ((now - (lock.startedAt || lock.lockedAt)) / total) * 100))
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <TokenLogo sel={lock} size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate">{lock.symbol}</span>
            {lock.durationLabel && <span className="text-xs text-[var(--color-ink-faint)]">· {lock.durationLabel}</span>}
          </div>
          <div className="font-mono num text-sm text-[var(--color-ink-soft)]">{lock.amount} <span className="text-[var(--color-ink-faint)]">{lock.symbol}</span></div>
          {showOwner && lock.owner && <div className="text-[10px] text-[var(--color-ink-faint)] font-mono mt-0.5">by {short(lock.owner)}</div>}
        </div>
        <div className="text-right shrink-0">
          {ready && mine && onUnlock ? (
            <button onClick={onUnlock} className="btn btn-holo !py-2 !px-4 text-sm">Unlock</button>
          ) : ready ? (
            <div className="chip chip-up">Unlocked</div>
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
        <span>Locked {fmtDate(lock.startedAt || lock.lockedAt)}</span>
        <span>{ready ? 'Ready' : fmtDate(lock.unlockAt)}</span>
      </div>
    </div>
  )
}
