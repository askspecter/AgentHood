import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { XGlyph } from './icons'

/**
 * The sign-in button (signed out) and the account chip + menu (signed in).
 * Real X identity only — no demo balance.
 */
export default function LoginButton() {
  const { wallet, connect, disconnect } = useStore()
  const [open, setOpen] = useState(false)
  const nav = useNavigate()

  if (!wallet) {
    return (
      <button className="btn btn-holo" onClick={connect} title="Sign in with X">
        <span>Sign in with</span>
        <XGlyph size={13} color="#0b0a12" />
      </button>
    )
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
          <span className="w-6 h-6 rounded-full grid place-items-center font-semibold text-xs text-white"
            style={{ background: 'linear-gradient(180deg,#9789ff,#6f5cf2)' }}>{(wallet.handle?.replace(/^@/, '')[0] || 'Y').toUpperCase()}</span>
        )}
        <span className="text-xs font-medium">{wallet.handle}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-60 card p-3 z-50">
          <div className="flex items-center gap-2 mb-1">
            <XGlyph size={13} color="var(--color-ink)" />
            <span className="text-sm font-semibold">{wallet.handle}</span>
          </div>
          {wallet.address && (
            <div className="font-mono text-xs text-[var(--color-ink-soft)] mb-3 break-all">{wallet.address}</div>
          )}
          <button className="btn btn-secondary w-full text-sm mb-2" onClick={() => { setOpen(false); nav('/you') }}>Portfolio</button>
          <button className="btn btn-danger w-full text-sm" onClick={() => { disconnect(); setOpen(false) }}>Sign out</button>
        </div>
      )}
    </div>
  )
}
