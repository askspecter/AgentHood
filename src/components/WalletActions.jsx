import { useCallback, useState } from 'react'
import { parseEther, parseUnits, isAddress } from 'ethers'
import { useStore } from '../lib/store'
import TradePanel from './TradePanel'

/**
 * Portfolio quick actions — Receive · Send · Trade.
 *
 * Real, on the X-derived wallet: Receive shows the deposit address, Send moves
 * ETH or a token out via /api/terminal/send (signed server-side), and Trade
 * opens the pons-style swap sheet for any coin.
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
              style={{ background: 'var(--holo)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.5), 0 6px 18px -8px rgba(180,150,255,.9)' }}>
              <a.icon />
            </span>
            <span className="text-[11px] sm:text-xs font-medium">{a.label}</span>
          </button>
        ))}
      </div>

      {modal === 'receive' && <DepositModal wallet={wallet} receive onClose={() => setModal(null)} />}
      {modal === 'send' && <SendModal wallet={wallet} onClose={() => setModal(null)} />}
      {modal === 'trade' && (
        <Overlay onClose={() => setModal(null)} title="Trade">
          <TradePanel editableToken bare />
        </Overlay>
      )}
    </>
  )
}

function Overlay({ children, onClose, title }) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 backdrop-blur-md p-4" onClick={onClose}>
      <div className="w-full max-w-sm p-4 rounded-3xl border border-white/10 max-h-[88vh] overflow-y-auto"
        style={{ background: '#0e0c16', boxShadow: '0 24px 60px -20px rgba(0,0,0,0.9)' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-2xl">{title}</h3>
          <button onClick={onClose} className="grid place-items-center w-8 h-8 rounded-full hover:bg-[var(--color-paper-2)] text-[var(--color-ink-soft)]">✕</button>
        </div>
        {children}
      </div>
    </div>
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
        <p className="text-sm text-[var(--color-ink-soft)]">Sign in with X to get a wallet address.</p>
      )}
    </Overlay>
  )
}

function SendModal({ wallet, onClose }) {
  const [asset, setAsset] = useState('native') // 'native' | 'token'
  const [tokenAddr, setTokenAddr] = useState('')
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)

  const submit = useCallback(async () => {
    setError(null); setDone(null)
    if (!isAddress(to)) { setError('Enter a valid recipient address.'); return }
    if (!amount || Number(amount) <= 0) { setError('Enter an amount.'); return }
    if (asset === 'token' && !isAddress(tokenAddr)) { setError('Enter a valid token address.'); return }
    setBusy(true)
    try {
      const amountRaw = (asset === 'native' ? parseEther(amount) : parseUnits(amount, 18)).toString()
      const body = { asset, to, amountRaw, network: 'robinhood', ...(asset === 'token' ? { token: tokenAddr } : {}) }
      const res = await fetch('/api/terminal/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await res.json()
      if (!res.ok) setError(j.error || 'The send failed.')
      else setDone({ hash: j.hash })
    } catch { setError('The send failed.') } finally { setBusy(false) }
  }, [asset, tokenAddr, to, amount])

  return (
    <Overlay onClose={onClose} title="Send">
      {!wallet ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Sign in with X first.</p>
      ) : done ? (
        <div className="chip chip-up w-full">Sent ✓ {done.hash && <span className="font-mono text-xs break-all"> {done.hash.slice(0, 10)}…</span>}</div>
      ) : (
        <>
          <div className="seg mb-4">
            <button className={`flex-1 ${asset === 'native' ? 'on' : ''}`} onClick={() => setAsset('native')}>ETH</button>
            <button className={`flex-1 ${asset === 'token' ? 'on' : ''}`} onClick={() => setAsset('token')}>Token</button>
          </div>
          {asset === 'token' && (
            <label className="block mb-3">
              <span className="text-xs text-[var(--color-ink-soft)]">Token address</span>
              <input value={tokenAddr} onChange={(e) => setTokenAddr(e.target.value)} placeholder="0x…" spellCheck={false} className="input mt-1" />
            </label>
          )}
          <label className="block mb-3">
            <span className="text-xs text-[var(--color-ink-soft)]">Recipient</span>
            <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x… address" spellCheck={false} className="input mt-1" />
          </label>
          <label className="block mb-4">
            <span className="text-xs text-[var(--color-ink-soft)]">Amount {asset === 'native' ? '(ETH)' : ''}</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0" inputMode="decimal" className="input mt-1" />
          </label>
          {error && <div className="chip chip-down w-full mb-3">{error}</div>}
          <button onClick={submit} disabled={busy} className="btn btn-primary w-full">{busy ? 'Sending…' : 'Send'}</button>
          <p className="text-[11px] text-center text-[var(--color-ink-faint)] mt-3">Simulated first, signed by your X wallet.</p>
        </>
      )}
    </Overlay>
  )
}

function PlusIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0b0a12" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg> }
function ReceiveIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0b0a12" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v12M6 11l6 6 6-6" /><path d="M5 20h14" /></svg> }
function SendIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0b0a12" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" /></svg> }
function TradeIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0b0a12" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h13l-3-3M20 16H7l3 3" /></svg> }
