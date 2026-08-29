import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Back, XLogo, Gift, Share } from '../components/icons'

/**
 * Referral code - your personal invite.
 *
 * The code is drawn from your wallet address, so it's unique to you, and the
 * link carries it as ?ref= for whoever you share it with. When they connect a
 * wallet through it, the referrer is credited server-side (once per new
 * account), and the counts rank the Top Referral leaderboard.
 */
export default function Referral() {
  const nav = useNavigate()
  const { wallet, connect } = useStore()
  const [copied, setCopied] = useState('')

  if (!wallet) {
    return (
      <div className="max-w-md mx-auto text-center py-24">
        <h1 className="font-serif text-3xl mb-2">Referral code</h1>
        <p className="text-[var(--color-ink-soft)] mb-7">Connect your wallet to get your personal referral code and link.</p>
        <button onClick={connect} className="btn btn-primary mx-auto">Connect Wallet</button>
      </div>
    )
  }

  // A clean, URL-safe code from the wallet address (the handle carries a
  // Unicode ellipsis, which can't go in a link).
  const code = (wallet.address ? wallet.address.slice(2, 10) : 'aurn').toUpperCase()
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://aurn.fun'
  const link = `${origin}/?ref=${code}`

  const copy = async (text, which) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(which)
      setTimeout(() => setCopied(''), 1600)
    } catch {}
  }

  const share = async () => {
    const text = `Trade agents on AURN - real coins on Robinhood Chain. Join with my code ${code}:`
    if (navigator.share) {
      try { await navigator.share({ title: 'AURN', text, url: link }) } catch {}
    } else {
      copy(`${text} ${link}`, 'share')
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => nav(-1)} className="grid place-items-center w-10 h-10 rounded-lg border hairline hover:bg-[var(--color-paper-2)]"><Back size={18} /></button>
        <h1 className="font-serif text-3xl">Referral code</h1>
      </div>

      {/* the code */}
      <div className="card p-7 text-center mb-4">
        <div className="mx-auto mb-5 w-12 h-12 rounded-2xl grid place-items-center" style={{ background: 'var(--holo)' }}>
          <Gift size={22} stroke="#0b0a12" />
        </div>
        <div className="eyebrow mb-2">Your code</div>
        <div className="font-mono text-3xl font-semibold tracking-[0.12em] mb-5 break-all">{code}</div>
        <button onClick={() => copy(code, 'code')} className="btn btn-secondary mx-auto">{copied === 'code' ? 'Copied ✓' : 'Copy code'}</button>
      </div>

      {/* the link */}
      <div className="card p-5 mb-4">
        <div className="eyebrow mb-2">Invite link</div>
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl panel-soft font-mono text-sm text-[var(--color-ink-soft)] truncate">{link}</div>
          <button onClick={() => copy(link, 'link')} className="btn btn-secondary !py-2 shrink-0">{copied === 'link' ? '✓' : 'Copy'}</button>
        </div>
        <button onClick={share} className="btn btn-primary w-full justify-center mt-3">
          <Share size={15} /> {copied === 'share' ? 'Copied ✓' : 'Share invite'}
        </button>
      </div>

      {/* how it works */}
      <div className="card p-6">
        <div className="eyebrow mb-3">How it works</div>
        <ol className="space-y-3 text-sm text-[var(--color-ink-soft)]">
          <Step n={1}>Share your code or link with a friend.</Step>
          <Step n={2}>They connect their wallet through your link.</Step>
          <Step n={3}>You climb the referral leaderboard as friends join.</Step>
        </ol>
      </div>
    </div>
  )
}

function Step({ n, children }) {
  return (
    <li className="flex items-start gap-3">
      <span className="shrink-0 w-6 h-6 grid place-items-center rounded-full panel-soft font-mono text-xs text-[var(--color-ink)]">{n}</span>
      <span className="flex-1 pt-0.5">{children}</span>
    </li>
  )
}
