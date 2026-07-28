import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { usd } from '../lib/format'
import { XGlyph } from './icons'

export default function LoginButton() {
  const { wallet, connect, disconnect, cash } = useStore()
  const [open, setOpen] = useState(false)
  const nav = useNavigate()

  if (!wallet) {
    return (
      <button className="btn btn-primary" onClick={connect} title="Sign in with X">
        <XGlyph size={13} color="#fff" />
        <span className="hidden sm:inline">Sign in</span>
      </button>
    )
  }

  return (
    <div className="relative">
      <button
        className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border hairline hover:bg-[var(--color-paper-2)] transition"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="w-6 h-6 rounded-full grid place-items-center font-serif text-xs text-white"
          style={{ background: 'linear-gradient(180deg,#9789ff,#6f5cf2)', color: '#fff' }}>Y</span>
        <span className="font-mono text-xs num font-medium">{usd(cash)}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 card p-3 z-50">
          <div className="flex items-center gap-2 mb-1">
            <XGlyph size={13} color="var(--color-ink)" />
            <span className="text-sm font-semibold">{wallet.handle}</span>
          </div>
          <div className="font-mono text-xs text-[var(--color-ink-soft)] mb-3">{wallet.address}</div>
          <div className="flex items-center justify-between text-sm mb-3">
            <span className="text-[var(--color-ink-soft)]">Balance</span>
            <span className="font-mono num font-semibold">{usd(cash)} USDC</span>
          </div>
          <button className="btn btn-secondary w-full text-sm mb-2" onClick={() => { setOpen(false); nav('/you') }}>View portfolio</button>
          <button className="btn btn-danger w-full text-sm" onClick={() => { disconnect(); setOpen(false) }}>Sign out</button>
        </div>
      )}
    </div>
  )
}
