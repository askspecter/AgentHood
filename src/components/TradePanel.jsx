import { useMemo, useState } from 'react'
import { useAccount, useBalance, useReadContract, useWriteContract, useSwitchChain } from 'wagmi'
import { formatEther, formatUnits, parseEther, parseUnits } from 'viem'
import { v3SwapRouterAbi, erc20MiniAbi } from '../lib/pons/abis'
import { PONS_V1 } from '../lib/pons'
import { robinhoodChain, explorerTx } from '../lib/chain'
import { useStore } from '../lib/store'

/**
 * Non-custodial in-app trading for v1 tokens via the Uniswap V3 SwapRouter,
 * signed by the connected wallet (ported from Launchpad-Base's V3TradeWidget):
 *   • Buy:  ETH → token in one tx (router wraps the ETH).
 *   • Sell: token → WETH (approve, then swap).
 * Min-out is estimated from the current spot price with a slippage buffer.
 */
export default function TradePanel({ token, symbol = 'TOKEN', priceInWeth = null, decimals = 18, poolFee = 0, bare = false }) {
  const { wallet, connect } = useStore()
  const { address, isConnected, chainId } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const { switchChainAsync } = useSwitchChain()
  const [side, setSide] = useState('buy')
  const [amount, setAmount] = useState('')
  const [slippage, setSlippage] = useState(10)
  const [status, setStatus] = useState('idle') // idle | busy | done | error
  const [txHash, setTxHash] = useState(null)
  const [error, setError] = useState(null)

  const router = PONS_V1.swapRouter
  const weth = PONS_V1.weth
  const fee = poolFee || PONS_V1.poolFee || 10000
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

  const estimate = useMemo(() => {
    if (!priceInWeth || priceInWeth <= 0 || !amount || Number(amount) <= 0) return null
    const a = Number(amount)
    if (side === 'buy') return `≈ ${(a / priceInWeth).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${sym}`
    return `≈ ${(a * priceInWeth).toPrecision(4)} WETH`
  }, [priceInWeth, amount, side, sym])

  function floatToUnits(x, dec) {
    return parseUnits(Math.max(0, x).toFixed(Math.min(dec, 12)), dec)
  }

  async function trade() {
    setError(null)
    if (!isConnected || !address) return connect()
    if (!priceInWeth || priceInWeth <= 0) { setError('No price available to estimate this trade.'); return }
    const factor = (100 - slippage) / 100
    try {
      setStatus('busy')
      if (chainId !== robinhoodChain.id) {
        try { await switchChainAsync({ chainId: robinhoodChain.id }) }
        catch { setStatus('error'); setError(`Switch your wallet to ${robinhoodChain.name} (chain ${robinhoodChain.id}) — an EVM chain, not Solana — then try again.`); return }
      }
      let hash
      if (side === 'buy') {
        const amountIn = parseEther(amount)
        const minTokens = floatToUnits((Number(amount) / priceInWeth) * factor, decimals)
        hash = await writeContractAsync({
          address: router, abi: v3SwapRouterAbi, functionName: 'exactInputSingle',
          args: [{ tokenIn: weth, tokenOut: token, fee, recipient: address, amountIn, amountOutMinimum: minTokens, sqrtPriceLimitX96: 0n }],
          value: amountIn, chainId: robinhoodChain.id,
        })
      } else {
        const tokensIn = parseUnits(amount, decimals)
        const minWeth = parseEther((Number(amount) * priceInWeth * factor).toFixed(18))
        await writeContractAsync({
          address: token, abi: erc20MiniAbi, functionName: 'approve', args: [router, tokensIn], chainId: robinhoodChain.id,
        })
        hash = await writeContractAsync({
          address: router, abi: v3SwapRouterAbi, functionName: 'exactInputSingle',
          args: [{ tokenIn: token, tokenOut: weth, fee, recipient: address, amountIn: tokensIn, amountOutMinimum: minWeth, sqrtPriceLimitX96: 0n }],
          chainId: robinhoodChain.id,
        })
      }
      setTxHash(hash); setStatus('done'); setAmount('')
      setTimeout(() => { refetchEth(); refetchToken() }, 3000)
    } catch (err) {
      setStatus('error')
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
      {estimate && <p className="mt-2 text-xs text-[var(--color-ink-soft)]">{estimate}</p>}
      {insufficient && <p className="mt-2 text-xs text-[var(--color-down)]">Insufficient {balanceSymbol} balance.</p>}

      <div className="mt-3 flex items-center gap-2 text-xs text-[var(--color-ink-soft)]">
        <span>Slippage</span>
        {[1, 5, 10, 25].map((s) => (
          <button key={s} onClick={() => setSlippage(s)} className={`chip cursor-pointer ${slippage === s ? 'chip-brand' : ''}`}>{s}%</button>
        ))}
      </div>

      <button className="btn btn-holo w-full mt-3 !py-3" disabled={busy || (isConnected && (!amount || insufficient))} onClick={trade}>
        {busy ? 'Confirm in wallet…' : !isConnected ? 'Connect Wallet' : insufficient ? `Insufficient ${balanceSymbol}` : side === 'buy' ? `Buy ${sym}` : `Sell ${sym}`}
      </button>

      {status === 'done' && txHash && (
        <a className="mt-2 block text-xs text-center underline text-[var(--color-ink-soft)]" href={explorerTx(txHash)} target="_blank" rel="noreferrer">Trade sent — view on explorer ↗</a>
      )}
      {side === 'sell' && <p className="mt-2 text-[10px] text-[var(--color-ink-faint)]">Selling returns WETH; unwrap to ETH in your wallet.</p>}
      {error && <p className="mt-2 whitespace-pre-wrap text-xs text-[var(--color-down)]">{error}</p>}
    </section>
  )
}
