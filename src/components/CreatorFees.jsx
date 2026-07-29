import { useEffect, useState } from 'react'

/**
 * Creator fees — shown ONLY to the wallet that launched this coin.
 *
 * Pool fees accrue to the permanent liquidity position; the creator can claim
 * their share here, signed by their X wallet. Everyone else sees nothing: the
 * component renders null unless /api/creator/status says you're the creator.
 */

const NETWORK = 'robinhood'
const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')

const fmtAmt = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: n >= 1 ? 4 : 8 })
const fmtUsd = (n) => (n == null ? null : '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: n >= 1 ? 2 : 4 }))

export default function CreatorFees({ token, symbol }) {
  const [status, setStatus] = useState(null)
  const [fees, setFees] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [txHash, setTxHash] = useState(null)

  const loadFees = () => {
    fetch(`/api/creator/fees?token=${token}&network=${NETWORK}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setFees(j))
      .catch(() => {})
  }

  useEffect(() => {
    let cancelled = false
    fetch(`/api/creator/status?token=${token}&network=${NETWORK}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled) { setStatus(j); if (j?.isCreator) loadFees() } })
      .catch(() => {})
    return () => { cancelled = true }
  }, [token])

  if (!status || !status.isCreator) return null

  const s = status.split || {}
  const parts = [
    `${s.creator ?? 70}% you`,
    `${s.protocol ?? 30}% pons`,
    ...(s.eska ? [`${s.buyback}% $ESKA buyback & burn`, `${s.ops}% ops`] : []),
  ]

  const claim = async () => {
    setBusy(true); setMsg(null); setTxHash(null)
    try {
      const res = await fetch('/api/creator/claim', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, network: NETWORK }),
      })
      const j = await res.json()
      if (res.ok && j.ok) { setTxHash(j.hash); setMsg({ ok: true, text: 'Fees claimed to your wallet.' }); loadFees() }
      else setMsg({ ok: false, text: j.error || 'Could not claim right now.' })
    } catch {
      setMsg({ ok: false, text: 'Could not reach the claim service.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card p-6">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 grid place-items-center rounded-xl panel-soft shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink)" strokeWidth="1.9" strokeLinejoin="round">
            <ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
          </svg>
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold">Creator fees</div>
          <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">Pool fees accrue without unlocking the permanent liquidity position.</p>
        </div>
      </div>

      {/* accrued fees — read live, pons-style */}
      {Array.isArray(fees?.accrued) && fees.accrued.length > 0 && (
        <div className="mt-4 space-y-2">
          {fees.accrued.map((a) => (
            <div key={a.symbol} className="flex items-center justify-between p-3 rounded-xl panel-soft">
              <div>
                <div className="eyebrow">Accrued {a.symbol}</div>
                <div className="font-mono num text-lg mt-0.5">{fmtAmt(a.amount)}</div>
              </div>
              {a.usd != null && <div className="font-mono num text-sm text-[var(--color-ink-soft)]">{fmtUsd(a.usd)}</div>}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 text-sm text-[var(--color-ink-soft)] font-mono num">{parts.join(' · ')}</div>

      <div className="mt-4 flex items-center justify-between gap-3 p-3 rounded-xl panel-soft">
        <div className="min-w-0">
          <div className="eyebrow">Payout wallet</div>
          <div className="font-mono text-sm truncate">{short(status.payoutWallet)}</div>
        </div>
        <span className="text-xs text-[var(--color-ink-faint)] shrink-0">your X wallet</span>
      </div>

      {msg && (
        <div className={`mt-3 text-sm ${msg.ok ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}`}>
          {msg.text}
          {txHash && status.explorer && (
            <a href={`${status.explorer}/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="underline ml-1">view ↗</a>
          )}
        </div>
      )}

      <button onClick={claim} disabled={busy} className="btn btn-holo w-full !py-3 mt-4">
        {busy ? 'Claiming…' : 'Claim fees'}
      </button>
    </div>
  )
}
