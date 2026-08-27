import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Back, XLogo } from '../components/icons'

/**
 * AI access — connect ESKA to your AI through the MCP server.
 *
 * Generates a personal API key (spend authority over your custodial wallet) and
 * shows how to wire eska.fun/api/mcp into a client like Claude or Cursor.
 */
const ENDPOINT = 'https://eska.fun/api/mcp'

export default function AiAccess() {
  const nav = useNavigate()
  const { wallet, connect } = useStore()
  const [key, setKey] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [copied, setCopied] = useState('')

  const copy = async (text, which) => {
    try { await navigator.clipboard.writeText(text); setCopied(which); setTimeout(() => setCopied(''), 1600) } catch {}
  }

  const generate = async () => {
    setBusy(true); setErr(null)
    try {
      const res = await fetch('/api/keys', { method: 'POST' })
      const j = await res.json()
      if (res.ok && j.key) setKey(j.key)
      else setErr(j.error || 'Could not generate a key.')
    } catch { setErr('Could not reach the key service.') } finally { setBusy(false) }
  }

  if (!wallet) {
    return (
      <div className="max-w-md mx-auto text-center py-24">
        <h1 className="font-serif text-3xl mb-2">AI access</h1>
        <p className="text-[var(--color-ink-soft)] mb-7">Connect your wallet to generate your ESKA API key and connect your AI.</p>
        <button onClick={connect} className="btn btn-primary mx-auto">Connect Wallet</button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => nav(-1)} className="grid place-items-center w-10 h-10 rounded-lg border hairline hover:bg-[var(--color-paper-2)]"><Back size={18} /></button>
        <h1 className="font-serif text-3xl">AI access</h1>
      </div>

      <div className="card p-6 mb-4">
        <div className="font-semibold">Connect ESKA to your AI</div>
        <p className="text-sm text-[var(--color-ink-soft)] mt-1">
          ESKA runs an <b>MCP server</b>, so an AI client (Claude, Cursor, …) can browse coins, get quotes, and — with your key — trade and launch on your behalf.
        </p>

        <div className="mt-5">
          <div className="eyebrow mb-2">MCP endpoint</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl panel-soft font-mono text-sm text-[var(--color-ink-soft)] truncate">{ENDPOINT}</div>
            <button onClick={() => copy(ENDPOINT, 'ep')} className="btn btn-secondary !py-2 shrink-0">{copied === 'ep' ? '✓' : 'Copy'}</button>
          </div>
        </div>
      </div>

      <div className="card p-6 mb-4">
        <div className="eyebrow mb-2">Your API key</div>
        {key ? (
          <>
            <div className="px-3.5 py-3 rounded-xl panel-soft font-mono text-xs break-all">{key}</div>
            <button onClick={() => copy(key, 'key')} className="btn btn-primary w-full justify-center mt-3">{copied === 'key' ? 'Copied ✓' : 'Copy key'}</button>
            <p className="text-xs text-[var(--color-down)] mt-3">
              Copy it now — it isn't shown again. This key can trade and launch from your wallet; treat it like a password and never paste it publicly.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-[var(--color-ink-soft)] mb-4">Generate a personal key. It carries spend authority over your ESKA wallet, so only paste it into an AI client you trust.</p>
            <button onClick={generate} disabled={busy} className="btn btn-primary w-full justify-center">{busy ? 'Generating…' : 'Generate API key'}</button>
            {err && <p className="text-sm text-[var(--color-down)] mt-3">{err}</p>}
          </>
        )}
      </div>

      <div className="card p-6">
        <div className="eyebrow mb-3">How to connect</div>
        <ol className="space-y-3 text-sm text-[var(--color-ink-soft)]">
          <Step n={1}>Add <span className="font-mono">{ENDPOINT}</span> as an MCP server in your client (Claude, Cursor, …).</Step>
          <Step n={2}>Set the auth header <span className="font-mono">Authorization: Bearer &lt;your key&gt;</span>.</Step>
          <Step n={3}>Ask your AI to list coins or quote a trade. Read tools work immediately.</Step>
          <Step n={4}>Trading &amp; launching stay off until the operator enables writes — test with tiny amounts first.</Step>
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
