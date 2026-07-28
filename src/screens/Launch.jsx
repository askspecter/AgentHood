import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { XGlyph, Back } from '../components/icons'

/**
 * Real token launch.
 *
 * The pons factory's launch signature is discovered from its verified ABI on the
 * explorer (/api/factory), so nothing about the call is hardcoded. Signing in
 * with X mints a server-side wallet that pays the fee and signs the deployment
 * (/api/launch/execute); the created token is then recorded (/api/registry).
 */

const NETWORK = 'robinhood'
const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')

// Friendly labels for the field names launchpads use; hidden fields are still
// encoded but filled automatically (fee wallet → your X wallet, salt → random).
const FIELD_HINTS = [
  { match: /^(name|tokenname)$/i, label: 'Token name', placeholder: 'Name your token' },
  { match: /^(symbol|ticker)$/i, label: 'Symbol', placeholder: 'TICKER' },
  { match: /(logo|image|icon|avatar|uri)/i, label: 'Logo URL', placeholder: 'https://… image URL' },
  { match: /(description|desc|bio)/i, label: 'Description', placeholder: 'What is this token?', textarea: true },
  { match: /twitter/i, label: 'X', placeholder: 'https://x.com/…' },
  { match: /telegram/i, label: 'Telegram', placeholder: 'https://t.me/…' },
  { match: /website/i, label: 'Website', placeholder: 'https://…' },
  { match: /discord/i, hidden: true },
  { match: /farcaster/i, hidden: true },
  { match: /(feewallet|feerecipient|feeto|payout|creator)/i, hidden: true, fillWithAccount: true },
  { match: /(initialbuy|devbuy|firstbuy|buyamount)/i, label: 'Your first buy (ETH)', placeholder: '0', isEth: true },
  { match: /^(launchconfigid|configid|launchconfig)$/i, hidden: true },
  { match: /^(dexid|dex)$/i, hidden: true },
  { match: /^salt$/i, hidden: true, fillWithSalt: true },
]

function hintFor(field) {
  const found = FIELD_HINTS.find((h) => h.match.test(field.name || ''))
  return found || { label: field.name || field.path.join('.'), placeholder: field.type }
}

function randomSalt() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return '0x' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export default function Launch() {
  const { wallet, connect } = useStore()
  const user = wallet ? { username: (wallet.handle || '').replace(/^@/, ''), id: wallet.id } : null

  const [meta, setMeta] = useState(null)
  const [metaError, setMetaError] = useState(null)
  const [loading, setLoading] = useState(true)

  const [values, setValues] = useState({})
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  const [xWallet, setXWallet] = useState(null)

  useEffect(() => {
    fetch(`/api/factory?network=${NETWORK}`)
      .then((r) => r.json())
      .then((json) => { if (json.error) setMetaError(json.error); else setMeta(json) })
      .catch(() => setMetaError('Could not reach the factory endpoint.'))
      .finally(() => setLoading(false))

    fetch(`/api/wallet?network=${NETWORK}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => { if (json?.address) setXWallet(json.address) })
      .catch(() => {})
  }, [user])

  const fields = useMemo(() => meta?.chosen?.fields || [], [meta])

  // Auto-fill the hidden plumbing: fee wallet → X wallet, salt → fresh random.
  useEffect(() => {
    if (!fields.length) return
    setValues((prev) => {
      const next = { ...prev }
      for (const field of fields) {
        const hint = hintFor(field)
        const key = field.path.join('.')
        if (hint.fillWithAccount && xWallet) next[key] = xWallet
        if (hint.isEth) next[`${key}__isEth`] = true
        if (hint.fillWithSalt && !next[key]) next[key] = randomSalt()
      }
      return next
    })
  }, [xWallet, fields])

  const setValue = (key, value) => setValues((prev) => ({ ...prev, [key]: value }))

  const doLaunch = useCallback(async () => {
    if (!meta?.chosen || !user) return
    setBusy(true); setError(null); setResult(null)
    setStatus('Signing with your X wallet…')
    try {
      const fn = meta.chosen
      const feePath = fields.find((f) => hintFor(f).fillWithAccount)?.path.join('.') || null
      const buyKey = fields.find((f) => hintFor(f).isEth)?.path.join('.')
      const buyEth = buyKey ? Number(values[buyKey] || 0) : 0

      const res = await fetch('/api/launch/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fnName: fn.name, fnInputs: fn.inputs, values, feePath, buyEth, network: NETWORK }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.hint ? `${json.error} ${json.hint}` : json.error || 'The launch failed.'); setStatus(null); return }

      setResult({ txHash: json.hash, token: json.token })
      setStatus(null)

      if (json.token) {
        await fetch('/api/registry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: json.token, txHash: json.hash, deployer: json.owner, xUsername: user.username }),
        }).catch(() => {})
      }
    } catch {
      setError('Could not reach the create endpoint.'); setStatus(null)
    } finally {
      setBusy(false)
    }
  }, [meta, user, values, fields])

  return (
    <div className="max-w-lg mx-auto">
      <Link to="/" className="btn btn-secondary mb-5"><Back size={15} /> Discover</Link>

      <h1 className="font-serif text-3xl mb-1">Launch a coin</h1>
      <p className="text-[var(--color-ink-soft)] mb-6 text-sm">
        One transaction mints a fixed 1,000,000,000 supply and opens a locked WETH pool through the
        pons factory on Robinhood Chain. It appears on ponsfamily.com immediately.
      </p>

      <div className="card p-5">
        {loading && <div className="chip w-full mb-4">Reading the factory’s verified ABI…</div>}
        {metaError && <div className="chip chip-down w-full mb-4">Could not read the factory ABI. {metaError}</div>}

        {meta?.chosen && (
          <>
            {user ? (
              <div className="flex items-center gap-2 text-sm text-[var(--color-ink-soft)] mb-4">
                <span className="w-2 h-2 rounded-full bg-[var(--color-up)]" /> Creating with your X wallet
                {xWallet ? ` ${short(xWallet)}` : ''} · @{user.username}
              </div>
            ) : (
              <button onClick={connect} className="btn btn-holo w-full mb-4">
                Sign in with <XGlyph size={13} color="#0b0a12" /> to create
              </button>
            )}

            <div className="space-y-3">
              {fields.map((field) => {
                const hint = hintFor(field)
                if (hint.hidden) return null
                const key = field.path.join('.')
                return (
                  <label className="block" key={key}>
                    <span className="text-xs text-[var(--color-ink-soft)]">{hint.label}</span>
                    {hint.textarea ? (
                      <textarea className="input mt-1" rows={3} placeholder={hint.placeholder}
                        value={values[key] ?? ''} onChange={(e) => setValue(key, e.target.value)} />
                    ) : (
                      <input className="input mt-1" placeholder={hint.placeholder} spellCheck={false}
                        value={values[key] ?? ''} onChange={(e) => setValue(key, e.target.value)} />
                    )}
                  </label>
                )
              })}
            </div>

            {xWallet && (
              <p className="text-[11px] text-[var(--color-ink-faint)] mt-3">
                Creator fees go to your X wallet <code>{short(xWallet)}</code>, set automatically and not sendable elsewhere.
              </p>
            )}

            <button className="btn btn-primary w-full mt-4" onClick={doLaunch} disabled={busy || !user}>
              {busy ? 'Creating…' : `Create · ${meta.launchFeeEth} ETH fee`}
            </button>

            {status && <div className="chip w-full mt-4">{status}</div>}
            {error && <div className="chip chip-down w-full mt-4">{error}</div>}
            {result && (
              <div className="chip chip-up w-full mt-4">
                Created.{' '}
                {result.token ? <>Token <code>{short(result.token)}</code> is live.</> : 'Confirmed, but the token address could not be read.'}{' '}
                {meta.explorer && (
                  <a href={`${meta.explorer}/tx/${result.txHash}`} target="_blank" rel="noopener noreferrer" className="underline">View transaction ↗</a>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {meta?.factory && (
        <p className="text-[11px] text-center text-[var(--color-ink-faint)] mt-3">
          Factory {short(meta.factory)} · simulated before it is sent, so a bad argument costs nothing
        </p>
      )}
    </div>
  )
}
