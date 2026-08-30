import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Back } from '../components/icons'
import { num } from '../lib/format'
import {
  AURN_TOKEN_FALLBACK, REWARD_SUPPLY, REWARD_POOL,
  epochInfo, shareOf, rewardsFor, fmtReward, fmtCountdown,
} from '../lib/rewards'

/**
 * Settings → Rewards. Check what a wallet earns for holding $AURN: a pro-rata
 * share of this epoch's pool — $PONS plus tokenized Robinhood-Chain stocks —
 * with a live countdown to the next distribution. Public: anyone can check any
 * address, no wallet connect required.
 */
const NETWORK = 'robinhood'
const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')
const isAddr = (s) => /^0x[a-fA-F0-9]{40}$/.test(String(s || '').trim())
// Load a remote logo through the same-origin image proxy so it never gets
// blocked on mobile (raw IPFS gateways sometimes are). Same-origin/data URLs pass.
const proxied = (u) => (u && /^https?:\/\//.test(u) ? `/api/img?src=${encodeURIComponent(u)}` : u)

export default function Reward() {
  const nav = useNavigate()
  const { wallet, connect, agents } = useStore()

  // The official $AURN coin (live token address, price and logo from the feed).
  const official = useMemo(() => agents.find((a) => a.official) || null, [agents])
  const aurnToken = official?.token || AURN_TOKEN_FALLBACK
  const aurnPrice = official?.priceUsd ?? null

  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const epoch = epochInfo(now)

  // Real reward-token logos (stocks from Robinhood's directory, $PONS on-chain).
  const [logos, setLogos] = useState({})
  useEffect(() => {
    let cancelled = false
    fetch(`/api/reward-assets?network=${NETWORK}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled && j?.assets) setLogos(j.assets) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Which address we're checking — the connected wallet by default; editable.
  const [addr, setAddr] = useState('')
  const [editing, setEditing] = useState(false)
  const checkAddr = (addr && isAddr(addr)) ? addr.trim() : (wallet?.address || '')

  const [balance, setBalance] = useState(null) // number | null
  const [busy, setBusy] = useState(false)
  const reqRef = useRef(0)
  useEffect(() => {
    if (!isAddr(checkAddr)) { setBalance(null); return }
    const id = ++reqRef.current
    setBusy(true)
    fetch(`/api/wallet?network=${NETWORK}&address=${checkAddr}&token=${aurnToken}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (id !== reqRef.current) return
        const f = j?.token?.formatted
        setBalance(f != null ? Number(f) : 0)
      })
      .catch(() => { if (id === reqRef.current) setBalance(0) })
      .finally(() => { if (id === reqRef.current) setBusy(false) })
  }, [checkAddr, aurnToken])

  const share = shareOf(balance)
  const rewards = rewardsFor(balance)
  const holdingUsd = balance != null && aurnPrice != null ? balance * aurnPrice : null

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => nav(-1)} className="grid place-items-center w-10 h-10 rounded-lg border hairline hover:bg-[var(--color-paper-2)]"><Back size={18} /></button>
        <h1 className="font-serif text-3xl">Rewards</h1>
      </div>

      {/* Position / hero */}
      <div className="glass card-glow rounded-3xl p-6 mb-5 relative overflow-hidden">
        <span className="pointer-events-none absolute -right-6 -top-8 w-40 h-40 rounded-full blur-3xl opacity-40" style={{ background: 'radial-gradient(circle,#8fb0e6,transparent 62%)' }} />
        <div className="relative">
          <div className="eyebrow mb-1">Hold $AURN · earn the pool</div>
          {!checkAddr ? (
            <>
              <div className="font-serif text-2xl mt-2 mb-4">Connect to check your rewards.</div>
              <button onClick={connect} className="btn btn-holo !py-3">Connect Wallet</button>
            </>
          ) : (
            <>
              <div className="flex items-end justify-between gap-3 mt-2">
                <div>
                  <div className="font-mono num text-4xl font-bold holo-text leading-none">
                    {busy && balance == null ? '…' : num(balance || 0)}
                  </div>
                  <div className="text-sm text-[var(--color-ink-soft)] mt-1.5">$AURN held{holdingUsd != null && <span className="text-[var(--color-ink-faint)]"> · ${num(holdingUsd)}</span>}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono num text-lg font-semibold">{(share * 100).toLocaleString(undefined, { maximumFractionDigits: share < 0.0001 ? 4 : 3 })}%</div>
                  <div className="text-[11px] text-[var(--color-ink-faint)]">of supply</div>
                </div>
              </div>
              <div className="mt-4 h-1.5 rounded-full bg-[rgba(255,255,255,0.08)] overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.max(share * 100, share > 0 ? 1.5 : 0)}%`, background: 'var(--holo-line)' }} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Check another address */}
      <div className="card p-3.5 mb-5 flex items-center gap-2">
        {editing || (!wallet && !checkAddr) ? (
          <>
            <input autoFocus value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="Paste any 0x address to check…"
              className="input !py-2 flex-1 font-mono text-sm" />
            <button onClick={() => setEditing(false)} className="btn btn-secondary !py-2 text-sm shrink-0">Done</button>
          </>
        ) : (
          <>
            <span className="text-xs text-[var(--color-ink-faint)] font-mono flex-1 truncate">
              Checking {addr && isAddr(addr) ? 'address' : 'your wallet'} · {short(checkAddr)}
            </span>
            <button onClick={() => setEditing(true)} className="chip !py-1 shrink-0">Check another</button>
            {addr && <button onClick={() => { setAddr(''); setEditing(false) }} className="chip !py-1 shrink-0">Reset</button>}
          </>
        )}
      </div>

      {/* This epoch */}
      <div className="flex items-center justify-between mb-3">
        <div className="eyebrow">This epoch's rewards</div>
        <span className="chip chip-brand !py-1 font-mono num">{fmtCountdown(epoch.msLeft)} left</span>
      </div>
      <div className="mb-3 h-1 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${epoch.progress * 100}%`, background: 'var(--holo-line)' }} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {rewards.map((r) => (
          <RewardCard key={r.key} r={r} logo={logos[r.key]} showAmount={!!checkAddr} />
        ))}
      </div>

      <p className="text-[11px] text-center text-[var(--color-ink-faint)] mt-6 leading-relaxed">
        Estimated from the current pool and your live $AURN balance, split across the {num(REWARD_SUPPLY)} supply.
        Rewards accrue to holders each epoch — keep holding $AURN to keep earning. Non-custodial: AURN never holds your keys.
      </p>
    </div>
  )
}

function RewardLogo({ r, logo, size = 36 }) {
  // Try the on-chain/live logo first, then each static real-logo candidate, then
  // give up to the tinted letter tile. Rendered on a light tile so a dark mark
  // (e.g. Apple's) stays visible.
  const candidates = useMemo(() => {
    // $PONS: prefer its real on-chain/explorer logo (the Locked way). Stocks:
    // prefer the true company logo, with the explorer-resolved one as a backup.
    const ordered = r.key === 'PONS' ? [logo, ...(r.logos || [])] : [...(r.logos || []), logo]
    const seen = new Set()
    return ordered
      .filter((u) => u && typeof u === 'string' && !seen.has(u) && seen.add(u))
      .map(proxied)
  }, [logo, r])
  const [i, setI] = useState(0)

  if (i < candidates.length) {
    return (
      <span className="rounded-xl grid place-items-center shrink-0 overflow-hidden" style={{ width: size, height: size, background: '#eef2fb' }}>
        <img src={candidates[i]} alt="" onError={() => setI((n) => n + 1)}
          className="w-full h-full object-contain p-[3px]" />
      </span>
    )
  }
  return (
    <span className="rounded-xl grid place-items-center font-mono text-[10px] font-bold shrink-0"
      style={{ width: size, height: size, background: `linear-gradient(150deg, ${r.tint[0]}, ${r.tint[1]})`, color: '#0a0c15' }}>
      {r.key === 'PONS' ? 'P' : r.key.slice(0, 4)}
    </span>
  )
}

function RewardCard({ r, logo, showAmount }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2.5 mb-3">
        <RewardLogo r={r} logo={logo} />
        <div className="min-w-0">
          <div className="font-semibold text-sm leading-tight">{r.label}</div>
          <div className="text-[10px] text-[var(--color-ink-faint)] truncate">{r.sub}</div>
        </div>
      </div>
      <div className="font-mono num text-xl font-semibold holo-text leading-none">
        {showAmount ? fmtReward(r.amount) : '—'}<span className="text-xs text-[var(--color-ink-faint)] font-normal ml-1">{r.unit}</span>
      </div>
      <div className="text-[10px] text-[var(--color-ink-faint)] font-mono mt-1.5">
        pool {fmtReward(r.pool)}{r.unit ? ' ' + r.unit : ''}
      </div>
    </div>
  )
}
