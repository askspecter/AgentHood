import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'

/**
 * Connect-wallet button (disconnected) and the account chip + menu (connected).
 * Non-custodial — RainbowKit modal + wagmi, no X identity.
 */
function WalletGlyph({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
      <rect x="3" y="6" width="18" height="13" rx="3" />
      <path d="M3 10h18M16 14h2" />
    </svg>
  )
}

export default function WalletButton() {
  const { wallet, connect, disconnect } = useStore()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const nav = useNavigate()

  if (!wallet) {
    return (
      <button className="btn btn-holo" onClick={connect} title="Connect wallet">
        <WalletGlyph size={14} color="#0b0a12" />
        <span>Connect Wallet</span>
      </button>
    )
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(wallet.address); setCopied(true); setTimeout(() => setCopied(false), 1400) } catch {}
  }

  return (
    <div className="relative">
      <button
        className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border hairline hover:bg-[var(--color-paper-2)] transition"
        onClick={() => setOpen((o) => !o)}
      >
        {wallet.avatar ? (
          <img src={wallet.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
        ) : (
          <span className="w-6 h-6 rounded-full grid place-items-center"
            style={{ background: 'linear-gradient(180deg,#5f79c6,#43589f)' }}>
            <WalletGlyph size={12} color="#fff" />
          </span>
        )}
        <span className="text-xs font-medium font-mono">{wallet.handle}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-60 card p-3 z-50">
          <div className="flex items-center gap-2 mb-1">
            <WalletGlyph size={13} color="var(--color-ink)" />
            <span className="text-sm font-semibold font-mono">{wallet.handle}</span>
          </div>
          <button onClick={copy} className="font-mono text-xs text-[var(--color-ink-soft)] mb-3 break-all text-left w-full hover:text-[var(--color-ink)]">
            {copied ? 'Copied ✓' : wallet.address}
          </button>
          <button className="btn btn-secondary w-full text-sm mb-2" onClick={() => { setOpen(false); nav('/you') }}>Portfolio</button>
          <button className="btn btn-danger w-full text-sm" onClick={() => { disconnect(); setOpen(false) }}>Disconnect</button>
        </div>
      )}
    </div>
  )
}
