import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Back, XGlyph } from '../components/icons'

export default function Settings() {
  const nav = useNavigate()
  const { wallet, connect, disconnect } = useStore()

  const [copied, setCopied] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [exported, setExported] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState(null)

  const copyAddr = useCallback(async () => {
    if (!wallet?.address) return
    try { await navigator.clipboard.writeText(wallet.address); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch {}
  }, [wallet])

  const doExport = useCallback(async () => {
    setExporting(true); setError(null)
    try {
      const res = await fetch('/api/wallet/export', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Could not export the key.')
      else setExported(json)
    } catch {
      setError('Could not export the key.')
    } finally {
      setExporting(false); setConfirm(false)
    }
  }, [])

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => nav(-1)} className="grid place-items-center w-10 h-10 rounded-lg border hairline hover:bg-[var(--color-paper-2)]"><Back size={18} /></button>
        <h1 className="font-serif text-3xl">Settings</h1>
      </div>

      {!wallet ? (
        <div className="card p-6 text-center">
          <p className="text-[var(--color-ink-soft)] mb-4">Sign in with X to manage your account and wallet.</p>
          <button onClick={connect} className="btn btn-primary mx-auto">Sign in with <XGlyph size={13} color="#fff" /></button>
        </div>
      ) : (
        <>
          <div className="eyebrow mb-2">Account</div>
          <div className="card p-4 mb-6 flex items-center gap-3">
            {wallet.avatar
              ? <img src={wallet.avatar} alt="" className="w-11 h-11 rounded-full object-cover border hairline" />
              : <span className="w-11 h-11 rounded-full grid place-items-center font-bold text-white" style={{ background: 'linear-gradient(180deg,#9789ff,#6f5cf2)' }}>{(wallet.handle?.replace(/^@/, '')[0] || 'Y').toUpperCase()}</span>}
            <div className="min-w-0">
              <div className="font-semibold truncate">{wallet.name || wallet.handle}</div>
              <div className="text-sm text-[var(--color-ink-soft)] truncate">{wallet.handle}</div>
            </div>
          </div>

          <div className="eyebrow mb-2">Your X wallet</div>
          <div className="card p-4 mb-6">
            {wallet.address ? (
              <button onClick={copyAddr} title="Copy address" className="w-full text-left font-mono text-xs text-[var(--color-ink-soft)] break-all">
                {wallet.address} <span className="text-[var(--color-accent)]">{copied ? 'copied ✓' : 'copy'}</span>
              </button>
            ) : (
              <p className="text-sm text-[var(--color-ink-soft)]">Wallet address unavailable — set <code>WALLET_DERIVATION_SECRET</code> on the deployment.</p>
            )}

            {wallet.address && !exported && (
              confirm ? (
                <div className="mt-4">
                  <div className="chip chip-down w-full mb-3">The private key will appear on screen. Anyone who sees it controls this wallet forever — even after you sign out.</div>
                  <div className="flex gap-2">
                    <button className="btn btn-primary" onClick={doExport} disabled={exporting}>{exporting ? 'Deriving…' : 'Show it'}</button>
                    <button className="btn btn-secondary" onClick={() => setConfirm(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button className="btn btn-secondary mt-4" onClick={() => setConfirm(true)}>Export private key</button>
              )
            )}

            {exported && (
              <div className="mt-4">
                <div className="font-mono text-xs break-all p-3 rounded-lg border hairline mb-2">{exported.privateKey}</div>
                <div className="chip chip-down w-full mb-2">{exported.warning}</div>
                <button className="btn btn-secondary" onClick={() => setExported(null)}>Hide it</button>
              </div>
            )}
            {error && <div className="chip chip-down w-full mt-3">{error}</div>}
          </div>

          <button className="btn btn-danger w-full" onClick={() => { disconnect(); nav('/') }}>Sign out</button>
        </>
      )}
    </div>
  )
}
