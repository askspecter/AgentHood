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
      <button
        className="btn text-sm !py-2 !px-4 bg-black text-white border border-white/25 hover:bg-[#111]"
        onClick={connect}
        title="Sign in with X"
      >
        <XGlyph size={14} color="#fff" />
        Log in with X
      </button>
    )
  }

  return (
    <div className="relative">
      <button
        className="flex items-center gap-2 rounded-full pl-2.5 pr-3.5 py-1.5 text-sm bg-white/5 border border-white/15"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="w-2 h-2 rounded-full bg-[var(--color-up)]" />
        <span className="font-mono font-semibold">{usd(cash)}</span>
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
            <span className="font-mono font-semibold">{usd(cash)} USDC</span>
          </div>
          <button className="btn btn-ghost w-full text-sm mb-2" onClick={() => { setOpen(false); nav('/you') }}>View profile</button>
          <button className="btn btn-danger w-full text-sm" onClick={() => { disconnect(); setOpen(false) }}>Log out</button>
        </div>
      )}
    </div>
  )
}
