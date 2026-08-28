import { useCallback, useEffect, useState } from 'react'
import { useAccount, usePublicClient, useWriteContract } from 'wagmi'
import { formatUnits, formatEther } from 'viem'
import { v1LockerAbi } from '../lib/pons/abis'
import { robinhoodChain, explorerTx } from '../lib/chain'

/**
 * Creator fees — non-custodial. Pool fees accrue to the permanent liquidity
 * position; the creator claims their share by signing collectFees on the v1
 * locker with their OWN wallet (no server key). The panel shows only to the
 * wallet that launched this coin (the deployer or the fee-redirect wallet).
 */
const NETWORK = 'robinhood'
const eq = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase()
const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')
const fmtAmt = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: n >= 1 ? 4 : 8 })
const fmtUsd = (n) => (n == null ? null : '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: n >= 1 ? 2 : 4 }))

export default function CreatorFees({ token, symbol }) {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()

  const [info, setInfo] = useState(null)      // { locker, deployer, payoutWallet, isToken0, decimals, symbol, ... }
  const [accrTok, setAccrTok] = useState(0n)
  const [accrWeth, setAccrWeth] = useState(0n)
  const [busy, setBusy] = useState(false)
  const [txHash, setTxHash] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setInfo(null)
    fetch(`/api/creator/fee-info?token=${token}&network=${NETWORK}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled) setInfo(j?.claimable ? j : null) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [token])

  const payout = info?.payoutWallet || info?.deployer
  const isCreator = info && (eq(address, info.deployer) || eq(address, info.payoutWallet))

  // Read accrued fees by simulating collectFees as the payout wallet (no gas).
  const loadAccrued = useCallback(async () => {
    if (!publicClient || !info?.locker) return
    try {
      const { result } = await publicClient.simulateContract({
        address: info.locker, abi: v1LockerAbi, functionName: 'collectFees', args: [token], account: payout,
      })
      const [a0, a1] = result
      setAccrTok(info.isToken0 ? a0 : a1)
      setAccrWeth(info.isToken0 ? a1 : a0)
    } catch { setAccrTok(0n); setAccrWeth(0n) }
  }, [publicClient, info, token, payout])

  useEffect(() => { loadAccrued() }, [loadAccrued])

  // Only the creator sees the panel.
  if (!isCreator) return null

  const dec = info.decimals ?? 18
  const sym = (info.symbol || symbol || 'TOKEN').replace(/^\$/, '')
  const tokNum = Number(formatUnits(accrTok, dec))
  const wethNum = Number(formatEther(accrWeth))
  const tokUsd = info.tokenPriceUsd != null ? tokNum * info.tokenPriceUsd : null
  const wethUsd = info.ethUsd != null ? wethNum * info.ethUsd : null
  const rows = [
    { symbol: sym, amount: tokNum, usd: tokUsd },
    { symbol: 'WETH', amount: wethNum, usd: wethUsd },
  ]
  const share = info.creatorSharePercent ?? 70

  const claim = async () => {
    setBusy(true); setError(null); setTxHash(null)
    try {
      const hash = await writeContractAsync({
        address: info.locker, abi: v1LockerAbi, functionName: 'collectFees', args: [token], chainId: robinhoodChain.id,
      })
      setTxHash(hash)
      setTimeout(loadAccrued, 3500)
    } catch (err) {
      setError(err?.shortMessage || err?.message?.split('\n')[0] || 'Could not claim right now.')
    } finally { setBusy(false) }
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
          <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">Pool fees accrue without unlocking the permanent liquidity position. Signed by your own wallet.</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {rows.map((a) => (
          <div key={a.symbol} className="flex items-center justify-between p-3 rounded-xl panel-soft">
            <div>
              <div className="eyebrow">Accrued {a.symbol}</div>
              <div className="font-mono num text-lg mt-0.5">{fmtAmt(a.amount)}</div>
            </div>
            {a.usd != null && <div className="font-mono num text-sm text-[var(--color-ink-soft)]">{fmtUsd(a.usd)}</div>}
          </div>
        ))}
      </div>

      <div className="mt-4 text-sm text-[var(--color-ink-soft)] font-mono num">{share}% you · {100 - share}% protocol</div>

      <div className="mt-4 flex items-center justify-between gap-3 p-3 rounded-xl panel-soft">
        <div className="min-w-0">
          <div className="eyebrow">Payout wallet</div>
          <div className="font-mono text-sm truncate">{short(payout)}</div>
        </div>
        <span className="text-xs text-[var(--color-ink-faint)] shrink-0">{info.redirected ? 'fee redirect' : 'your wallet'}</span>
      </div>

      {(txHash || error) && (
        <div className={`mt-3 text-sm ${error ? 'text-[var(--color-down)]' : 'text-[var(--color-up)]'}`}>
          {error || 'Fees claimed to your wallet.'}
          {txHash && <a href={explorerTx(txHash)} target="_blank" rel="noopener noreferrer" className="underline ml-1">view ↗</a>}
        </div>
      )}

      <button onClick={claim} disabled={busy || (tokNum <= 0 && wethNum <= 0)} className="btn btn-holo w-full !py-3 mt-4">
        {busy ? 'Claiming…' : (tokNum <= 0 && wethNum <= 0) ? 'No fees to claim yet' : 'Claim fees'}
      </button>
    </div>
  )
}
