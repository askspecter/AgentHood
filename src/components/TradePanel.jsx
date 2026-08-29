import { useEffect, useMemo, useRef, useState } from 'react'
import { useAccount, useBalance, useReadContract, useSendTransaction, usePublicClient, useSwitchChain } from 'wagmi'
import { formatEther, formatUnits } from 'viem'
import { erc20MiniAbi } from '../lib/pons/abis'
import { robinhoodChain, explorerTx } from '../lib/chain'
import { useStore } from '../lib/store'

const NETWORK = 'robinhood'

/**
 * Non-custodial trading across every Pons venue. Pricing comes from /api/quote
 * (v3 pool · v4 · bonding curve), and execution is built by /api/terminal/build
 * as an ordered list of unsigned steps (approvals + swap) that the connected
 * wallet signs in turn via wagmi - no server key, the user's own wallet signs.
 */
export default function TradePanel({ token, symbol = 'TOKEN', decimals = 18, bare = false, onDone }) {
  const { connect } = useStore()
  const { address, isConnected, chainId } = useAccount()
  const { sendTransactionAsync } = useSendTransaction()
  const { switchChainAsync } = useSwitchChain()
  const publicClient = usePublicClient()

  const [side, setSide] = useState('buy')
  const [amount, setAmount] = useState('')
  const [slippage, setSlippage] = useState(5)
  const [quote, setQuote] = useState(null)
  const [quoting, setQuoting] = useState(false)
  const [status, setStatus] = useState('idle') // idle | busy | done | error
  const [stepMsg, setStepMsg] = useState('')
  const [txHash, setTxHash] = useState(null)
  const [error, setError] = useState(null)
  const sym = (symbol || 'TOKEN').replace(/^\$/, '')

  const { data: ethBal, refetch: refetchEth } = useBalance({ address, chainId: robinhoodChain.id, query: { enabled: !!address } })
  const { data: tokenBalRaw, refetch: refetchToken } = useReadContract({
    address: token, abi: erc20MiniAbi, functionName: 'balanceOf',
    args: address ? [address] : undefined, query: { enabled: !!address && !!token },
  })
  const ethBalance = ethBal ? Number(formatEther(ethBal.value)) : 0
  const tokenBalance = tokenBalRaw !== undefined ? Number(formatUnits(tokenBalRaw, decimals)) : 0
  const balance = side === 'buy' ? ethBalance : tokenBalance
  const balanceSymbol = side === 'buy' ? 'ETH' : sym
  const insufficient = !!amount && Number(amount) > 0 && Number(amount) > balance

  function fmtBal(x) {
    if (!x) return '0'
    if (x >= 1) return x.toLocaleString(undefined, { maximumFractionDigits: 4 })
    return x.toFixed(8).replace(/0+$/, '').replace(/\.$/, '')
  }
  function setMax() {
    if (side === 'buy') setAmount(String(Math.max(0, ethBalance - 0.0005)))
    else setAmount(tokenBalRaw !== undefined ? formatUnits(tokenBalRaw, decimals) : '0')
  }

  // Live quote (debounced) for the estimate + expectedOut used as the min-out.
  const qref = useRef(0)
  useEffect(() => {
    setQuote(null)
    if (!token || !amount || Number(amount) <= 0) return
    const id = ++qref.current
    const t = setTimeout(async () => {
      setQuoting(true)
      try {
        const res = await fetch('/api/quote', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, side, amount, network: NETWORK, slippage }),
        })
        const j = await res.json()
        if (id === qref.current) setQuote(res.ok ? j : null)
      } catch { if (id === qref.current) setQuote(null) } finally { if (id === qref.current) setQuoting(false) }
    }, 400)
    return () => clearTimeout(t)
  }, [token, side, amount, slippage])

  const estimate = useMemo(() => (quote?.amountOutLabel ? `≈ ${quote.amountOutLabel}` : null), [quote])

  async function trade() {
    setError(null)
    if (!isConnected || !address) return connect()
    if (!amount || Number(amount) <= 0) return
    try {
      setStatus('busy'); setStepMsg('Pricing…')
      // Fresh quote so the min-out floor matches what's on screen.
      let q = quote
      if (!q?.amountInRaw) {
        const r = await fetch('/api/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, side, amount, network: NETWORK, slippage }) })
        q = await r.json(); if (!r.ok) throw new Error(q.error || 'Could not price this trade.')
      }
      if (chainId !== robinhoodChain.id) {
        try { await switchChainAsync({ chainId: robinhoodChain.id }) }
        catch { throw new Error(`Switch your wallet to ${robinhoodChain.name} (chain ${robinhoodChain.id}) - an EVM chain, not Solana - then try again.`) }
      }

      // Ask the server to build the ordered, unsigned steps for this venue.
      setStepMsg('Building…')
      const bres = await fetch('/api/terminal/build', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, owner: address, side, amountInRaw: q.amountInRaw, expectedOutRaw: q.amountOutRaw, slippage, network: NETWORK }),
      })
      const plan = await bres.json()
      if (!bres.ok || !plan.steps?.length) throw new Error(plan.hint ? `${plan.error} ${plan.hint}` : plan.error || 'Could not build this trade.')

      // Sign each step in order - approvals first, swap last.
      let last
      for (let i = 0; i < plan.steps.length; i++) {
        const st = plan.steps[i]
        setStepMsg(st.label || (st.kind === 'swap' ? 'Confirm the swap…' : 'Confirm in wallet…'))
        const hash = await sendTransactionAsync({ to: st.to, data: st.data, value: BigInt(st.value || '0'), chainId: robinhoodChain.id })
        last = hash
        if (i < plan.steps.length - 1) { try { await publicClient.waitForTransactionReceipt({ hash }) } catch {} }
      }
      setTxHash(last); setStatus('done'); setStepMsg(''); setAmount(''); setQuote(null)
      onDone?.()
      setTimeout(() => { refetchEth(); refetchToken() }, 3000)
    } catch (err) {
      setStatus('error'); setStepMsg('')
      setError(err?.shortMessage || err?.message?.split('\n')[0] || 'Trade failed.')
    }
  }

  const busy = status === 'busy'

  return (
    <section className={bare ? '' : 'card p-4'}>
      <div className="seg w-full mb-3">
        <button onClick={() => { setSide('buy'); setAmount('') }} className={`flex-1 ${side === 'buy' ? 'on' : ''}`}>Buy</button>
        <button onClick={() => { setSide('sell'); setAmount('') }} className={`flex-1 ${side === 'sell' ? 'on' : ''}`}>Sell</button>
      </div>

      <div className="flex items-center justify-between text-xs text-[var(--color-ink-soft)] mb-1">
        <span>{side === 'buy' ? 'Amount in ETH' : `Amount in ${sym}`}</span>
        {isConnected && <span>Balance <span className="font-mono num text-[var(--color-ink)]">{fmtBal(balance)}</span> {balanceSymbol}</span>}
      </div>
      <div className="flex items-stretch gap-2">
        <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.0" inputMode="decimal" className="input font-mono" />
        {isConnected && <button onClick={setMax} className="btn btn-secondary shrink-0 !px-3 text-xs" disabled={balance <= 0}>Max</button>}
      </div>
      {(estimate || quoting) && <p className="mt-2 text-xs text-[var(--color-ink-soft)]">{quoting ? 'Pricing…' : estimate}</p>}
      {insufficient && <p className="mt-2 text-xs text-[var(--color-down)]">Insufficient {balanceSymbol} balance.</p>}

      <div className="mt-3 flex items-center gap-2 text-xs text-[var(--color-ink-soft)]">
        <span>Slippage</span>
        {[1, 5, 10, 25].map((sv) => (
          <button key={sv} onClick={() => setSlippage(sv)} className={`chip cursor-pointer ${slippage === sv ? 'chip-brand' : ''}`}>{sv}%</button>
        ))}
      </div>

      <button className="btn btn-holo w-full mt-3 !py-3" disabled={busy || (isConnected && (!amount || insufficient))} onClick={trade}>
        {busy ? (stepMsg || 'Working…') : !isConnected ? 'Connect Wallet' : insufficient ? `Insufficient ${balanceSymbol}` : side === 'buy' ? `Buy ${sym}` : `Sell ${sym}`}
      </button>

      {status === 'done' && txHash && (
        <a className="mt-2 block text-xs text-center underline text-[var(--color-ink-soft)]" href={explorerTx(txHash)} target="_blank" rel="noreferrer">Trade sent - view on explorer ↗</a>
      )}
      {side === 'sell' && <p className="mt-2 text-[10px] text-[var(--color-ink-faint)]">A pool sell settles in WETH - unwrap to ETH in your wallet.</p>}
      {error && <p className="mt-2 whitespace-pre-wrap text-xs text-[var(--color-down)]">{error}</p>}
    </section>
  )
}
