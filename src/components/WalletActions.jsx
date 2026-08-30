import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { parseEther, parseUnits, isAddress } from 'ethers'
import { useAccount, useSendTransaction, useSwitchChain } from 'wagmi'
import { encodeFunctionData, parseAbi } from 'viem'
import { robinhoodChain } from '../lib/chain'
import { useStore } from '../lib/store'
import { cachedHoldings, loadHoldings, invalidateHoldings } from '../lib/holdings'
import TradePanel from './TradePanel'
import CharmAvatar from './CharmAvatar'
import { Coin } from './icons'

/**
 * Portfolio quick actions - Receive · Send · Trade.
 *
 * Real, on your connected wallet: Receive shows the deposit address, Send moves
 * ETH or a token out - signed by your own wallet, non-custodially - and Trade
 * opens the pons-style swap sheet - with a picker of every coin you hold so you
 * can trade one in a tap, or paste any Robinhood Chain address to trade it.
 */
export default function WalletActions() {
  const { wallet } = useStore()
  const [modal, setModal] = useState(null) // 'receive' | 'send' | 'trade'

  const actions = [
    { key: 'receive', label: 'Receive', icon: ReceiveIcon, onClick: () => setModal('receive') },
    { key: 'send', label: 'Send', icon: SendIcon, onClick: () => setModal('send') },
    { key: 'trade', label: 'Trade', icon: TradeIcon, onClick: () => setModal('trade') },
  ]

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {actions.map((a) => (
          <button key={a.key} onClick={a.onClick}
            className="group flex flex-col items-center gap-2 py-3 rounded-2xl border hairline bg-[var(--color-paper-2)] hover:bg-[var(--color-line)] active:scale-95 transition">
            <span className="grid place-items-center w-10 h-10 rounded-full"
              style={{ background: 'var(--holo)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.5), 0 6px 18px -8px rgba(170,200,245,.9)' }}>
              <a.icon />
            </span>
            <span className="text-[11px] sm:text-xs font-medium">{a.label}</span>
          </button>
        ))}
      </div>

      {modal === 'receive' && <DepositModal wallet={wallet} receive onClose={() => setModal(null)} />}
      {modal === 'send' && <SendModal wallet={wallet} onClose={() => setModal(null)} />}
      {modal === 'trade' && <TradeModal wallet={wallet} onClose={() => setModal(null)} />}
    </>
  )
}

function Overlay({ children, onClose, title }) {
  if (typeof document === 'undefined') return null
  // Portal to <body> so the fixed overlay escapes the portfolio card's
  // backdrop-filter stacking context - otherwise later cards (the holdings
  // empty state, the nav) paint on top of it.
  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 backdrop-blur-md p-4" onClick={onClose}>
      <div className="w-full max-w-[360px] max-h-[86vh] flex flex-col rounded-3xl border border-white/10"
        style={{ background: '#0b0e16', boxShadow: '0 24px 70px -20px rgba(0,0,0,0.95)' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 pt-3.5 pb-1.5 shrink-0">
          <h3 className="font-serif text-xl">{title}</h3>
          <button onClick={onClose} className="grid place-items-center w-8 h-8 rounded-full hover:bg-[var(--color-paper-2)] text-[var(--color-ink-soft)]">✕</button>
        </div>
        <div className="px-4 pb-4 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body
  )
}

function DepositModal({ wallet, receive, onClose }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => { try { await navigator.clipboard.writeText(wallet?.address || ''); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {} }
  return (
    <Overlay onClose={onClose} title={receive ? 'Receive' : 'Add funds'}>
      {wallet?.address ? (
        <>
          <p className="text-sm text-[var(--color-ink-soft)] mb-4">
            {receive
              ? 'Share this address to receive ETH or any coin on Robinhood Chain.'
              : 'Send ETH to this address to fund your wallet for gas and buying.'}
          </p>
          <div className="rounded-2xl border hairline p-4 bg-[var(--color-paper-2)]">
            <div className="font-mono text-xs break-all leading-relaxed">{wallet.address}</div>
          </div>
          <button onClick={copy} className="btn btn-holo static w-full mt-4">{copied ? 'Copied ✓' : 'Copy address'}</button>
          <p className="text-[11px] text-center text-[var(--color-ink-faint)] mt-3">Robinhood Chain (chain ID 4663) · ETH for gas</p>
        </>
      ) : (
        <p className="text-sm text-[var(--color-ink-soft)]">Connect your wallet to see your address.</p>
      )}
    </Overlay>
  )
}

const fmtQty = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: n >= 1 ? 2 : 6 })

/**
 * A tappable list of every coin the wallet holds, loaded fast from the shared
 * cache (instant on a second open) with a background rescan. Reused by Send and
 * Trade so both feel the same and neither pays for the scan twice.
 */
function HeldTokenPicker({ selected, onPick }) {
  const [holdings, setHoldings] = useState(() => cachedHoldings()) // instant if warm
  useEffect(() => loadHoldings(setHoldings), [])

  const sel = String(selected || '').toLowerCase()
  return (
    <div>
      <span className="text-xs text-[var(--color-ink-soft)]">Your coins</span>
      {holdings === null ? (
        <div className="mt-1 text-sm text-[var(--color-ink-soft)] p-3 rounded-xl panel-soft">Reading your wallet…</div>
      ) : holdings.length === 0 ? (
        <div className="mt-1 text-sm text-[var(--color-ink-soft)] p-3 rounded-xl panel-soft">No coins held - paste an address below.</div>
      ) : (
        <div className="mt-1 max-h-44 overflow-y-auto no-scrollbar rounded-xl panel-soft divide-y divide-[var(--color-line)]">
          {holdings.map((h) => {
            const sym = (h.symbol || 'TOKEN').replace(/^\$/, '')
            const on = sel === String(h.token).toLowerCase()
            return (
              <button key={h.token} onClick={() => onPick(h)}
                className={`w-full flex items-center justify-between gap-2 p-3 text-left transition ${on ? 'bg-[var(--color-paper-2)]' : 'hover:bg-[var(--color-paper-2)]'}`}>
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className="w-8 h-8 grid place-items-center rounded-full panel-soft text-[var(--color-ink-soft)] shrink-0"><Coin size={15} /></span>
                  <span className="min-w-0">
                    <span className="block font-medium truncate">{h.name || `$${sym}`}</span>
                    <span className="block text-xs text-[var(--color-ink-faint)] font-mono num truncate">{fmtQty(h.qty)} ${sym}</span>
                  </span>
                </span>
                {on && <span className="text-[var(--color-up)] shrink-0">✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * Trade sheet - pick a held coin (or paste any Robinhood Chain address) and the
 * pons-style swap opens right under it. This is the whole "tap a coin, trade it"
 * flow the portfolio wanted, without leaving the wallet.
 */
function TradeModal({ wallet, onClose }) {
  const [sel, setSel] = useState(null) // { token, symbol, name } | null
  const [paste, setPaste] = useState('')
  const token = sel?.token || (isAddress(paste.trim()) ? paste.trim() : '')

  return (
    <Overlay onClose={onClose} title="Trade">
      {!wallet ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Connect your wallet first.</p>
      ) : (
        <>
          <HeldTokenPicker selected={token} onPick={(h) => { setSel(h); setPaste('') }} />
          <label className="block mt-2">
            <span className="text-[11px] text-[var(--color-ink-faint)]">or paste any coin address to trade</span>
            <input value={paste} onChange={(e) => { setPaste(e.target.value); setSel(null) }} placeholder="0x…" spellCheck={false} className="input mt-1" />
          </label>

          {isAddress(token) ? (
            <div className="mt-4 pt-4 border-t hairline">
              <TradePanel token={token} symbol={sel?.symbol} bare onDone={invalidateHoldings} />
            </div>
          ) : (
            <p className="text-[11px] text-center text-[var(--color-ink-faint)] mt-4">Pick a coin above, or paste an address - you can trade any token on Robinhood Chain.</p>
          )}
        </>
      )}
    </Overlay>
  )
}

const erc20TransferAbi = parseAbi(['function transfer(address to, uint256 amount) returns (bool)'])

function SendModal({ wallet, onClose }) {
  const { chainId } = useAccount()
  const { sendTransactionAsync } = useSendTransaction()
  const { switchChainAsync } = useSwitchChain()
  const [asset, setAsset] = useState('native') // 'native' | 'token'
  const [tokenAddr, setTokenAddr] = useState('')
  const [maxQty, setMaxQty] = useState(null)
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)

  const pickToken = (h) => {
    setTokenAddr(h.token)
    setMaxQty(Number.isFinite(h.qty) ? h.qty : null)
    setError(null)
  }

  const submit = useCallback(async () => {
    setError(null); setDone(null)
    if (!isAddress(to)) { setError('Enter a valid recipient address.'); return }
    if (!amount || Number(amount) <= 0) { setError('Enter an amount.'); return }
    if (asset === 'token' && !isAddress(tokenAddr)) { setError('Pick a token or paste a valid token address.'); return }
    setBusy(true)
    try {
      if (chainId !== robinhoodChain.id) {
        try { await switchChainAsync({ chainId: robinhoodChain.id }) }
        catch { throw new Error(`Switch your wallet to ${robinhoodChain.name} first.`) }
      }
      // Signed by the connected wallet - non-custodial. A plain ETH transfer for
      // native, or an ERC-20 transfer() call for a token.
      let hash
      if (asset === 'native') {
        hash = await sendTransactionAsync({ to, value: parseEther(amount), chainId: robinhoodChain.id })
      } else {
        const data = encodeFunctionData({ abi: erc20TransferAbi, functionName: 'transfer', args: [to, parseUnits(amount, 18)] })
        hash = await sendTransactionAsync({ to: tokenAddr, data, value: 0n, chainId: robinhoodChain.id })
      }
      invalidateHoldings(); setDone({ hash })
    } catch (err) {
      setError(err?.shortMessage || err?.message?.split('\n')[0] || 'The send failed.')
    } finally { setBusy(false) }
  }, [asset, tokenAddr, to, amount, chainId, sendTransactionAsync, switchChainAsync])

  return (
    <Overlay onClose={onClose} title="Send">
      {!wallet ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Connect your wallet first.</p>
      ) : done ? (
        <div className="chip chip-up w-full">Sent ✓ {done.hash && <span className="font-mono text-xs break-all"> {done.hash.slice(0, 10)}…</span>}</div>
      ) : (
        <>
          <div className="seg mb-4">
            <button className={`flex-1 ${asset === 'native' ? 'on' : ''}`} onClick={() => setAsset('native')}>ETH</button>
            <button className={`flex-1 ${asset === 'token' ? 'on' : ''}`} onClick={() => setAsset('token')}>Token</button>
          </div>

          {asset === 'token' && (
            <div className="mb-3">
              <HeldTokenPicker selected={tokenAddr} onPick={pickToken} />
              <label className="block mt-2">
                <span className="text-[11px] text-[var(--color-ink-faint)]">or paste a token address</span>
                <input value={tokenAddr} onChange={(e) => { setTokenAddr(e.target.value); setMaxQty(null) }} placeholder="0x…" spellCheck={false} className="input mt-1" />
              </label>
            </div>
          )}

          <label className="block mb-3">
            <span className="text-xs text-[var(--color-ink-soft)]">Recipient</span>
            <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x… address" spellCheck={false} className="input mt-1" />
          </label>
          <label className="block mb-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--color-ink-soft)]">Amount {asset === 'native' ? '(ETH)' : ''}</span>
              {asset === 'token' && maxQty != null && (
                <button type="button" onClick={() => setAmount(String(maxQty))} className="text-[11px] text-[var(--color-accent)] hover:underline">Max {fmtQty(maxQty)}</button>
              )}
            </div>
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0" inputMode="decimal" className="input mt-1" />
          </label>
          {error && <div className="chip chip-down w-full mb-3">{error}</div>}
          <button onClick={submit} disabled={busy} className="btn btn-primary w-full">{busy ? 'Sending…' : 'Send'}</button>
          <p className="text-[11px] text-center text-[var(--color-ink-faint)] mt-3">Signed by your own wallet - we never touch your funds.</p>
        </>
      )}
    </Overlay>
  )
}

function ReceiveIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0b0a12" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v12M6 11l6 6 6-6" /><path d="M5 20h14" /></svg> }
function SendIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0b0a12" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" /></svg> }
function TradeIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0b0a12" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h13l-3-3M20 16H7l3 3" /></svg> }
