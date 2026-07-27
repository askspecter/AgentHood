import { useState } from 'react'
import { useStore } from '../lib/store'
import { usd } from '../lib/format'

export default function WalletButton() {
  const { wallet, connect, disconnect, cash } = useStore()
  const [open, setOpen] = useState(false)

  if (!wallet) {
    return (
      <div className="relative">
        <button className="btn btn-primary text-sm" onClick={() => setOpen((o) => !o)}>
          Connect
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-60 card p-2 z-50">
            <p className="px-3 pt-2 pb-1 text-xs font-semibold text-[var(--color-ink-soft)]">Sign in to Charms</p>
            {[
              ['wallet', '👛', 'Continue with wallet'],
              ['email', '✉️', 'Continue with email'],
              ['x', '𝕏', 'Continue with X'],
              ['telegram', '✈️', 'Continue with Telegram'],
            ].map(([kind, ic, label]) => (
              <button
                key={kind}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white text-left text-sm"
                onClick={() => { connect(kind); setOpen(false) }}
              >
                <span className="text-lg w-5 text-center">{ic}</span>
                {label}
              </button>
            ))}
            <p className="px-3 py-2 text-[10px] text-[var(--color-ink-soft)]">Demo only — no real wallet or funds are used.</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      <button className="btn btn-ghost text-sm !py-1.5" onClick={() => setOpen((o) => !o)}>
        <span className="w-2 h-2 rounded-full bg-[var(--color-up)]" />
        <span className="font-mono">{usd(cash)}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 card p-3 z-50">
          <div className="text-sm font-semibold">{wallet.handle}</div>
          <div className="font-mono text-xs text-[var(--color-ink-soft)] mb-3">{wallet.address}</div>
          <div className="flex items-center justify-between text-sm mb-3">
            <span className="text-[var(--color-ink-soft)]">Balance</span>
            <span className="font-mono font-semibold">{usd(cash)} USDC</span>
          </div>
          <button className="btn btn-ghost w-full text-sm" onClick={() => { disconnect(); setOpen(false) }}>
            Disconnect
          </button>
        </div>
      )}
    </div>
  )
}
