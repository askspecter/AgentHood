import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Gear, XGlyph, Coin, Verified } from '../components/icons'
import WalletActions from '../components/WalletActions'

/**
 * Portfolio — real, on-chain.
 *
 * Everything here is read from the wallet minted for your X account: the ETH
 * balance and every coin it holds, priced live. The `portfolio` command's own
 * endpoint (/api/terminal) is the single source, so the numbers here and in the
 * terminal can never disagree.
 */

const NETWORK = 'robinhood'
const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')

/** Never show a raw RPC/SSL stack trace — translate it to something a human reads. */
function friendly(msg) {
  const s = String(msg || '')
  if (/SSL|EPROTO|handshake|allowlist|403|ECONN|ENOTFOUND|timeout|fetch|network|unreachable|502|server response/i.test(s)) {
    return "Couldn't reach Robinhood Chain right now — the RPC is unavailable. Tap Refresh in a moment."
  }
  return s
}
const fmtUsd = (n) =>
  n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })
const fmtEth = (n) =>
  n == null ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 6 }) + ' ETH'
const fmtQty = (n) =>
  Number(n).toLocaleString('en-US', { maximumFractionDigits: n >= 1 ? 2 : 6 })

export default function Profile() {
  const nav = useNavigate()
  const { wallet, connect } = useStore()

  const [folio, setFolio] = useState(null)
  const [ethUsd, setEthUsd] = useState(null)
  const [address, setAddress] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    if (!wallet) return
    setLoading(true)
    setError(null)
    try {
      // Address first, so the wallet card can render even if the (slower) scan
      // of held coins is still running or the rate lookup fails.
      const w = await fetch(`/api/wallet?network=${NETWORK}`).then((r) => (r.ok ? r.json() : null))
      if (w?.address) setAddress(w.address)

      const res = await fetch('/api/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: 'portfolio', network: NETWORK }),
      })
      const json = await res.json()
      if (json.data) {
        setFolio(json.data)
        setEthUsd(json.ethUsd ?? null)
        if (json.data.address) setAddress(json.data.address)
      } else if (json.error) {
        setError(friendly(json.error))
      } else if (json.lines?.length) {
        setError(friendly(json.lines.map((l) => l.text).join(' ')))
      }
    } catch {
      setError('Could not read your wallet.')
    } finally {
      setLoading(false)
    }
  }, [wallet])

  useEffect(() => { load() }, [load])

  const copyAddr = useCallback(async () => {
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {}
  }, [address])

  if (!wallet) {
    return (
      <div className="max-w-md mx-auto text-center py-24">
        <div className="orb-spin mx-auto mb-6 w-14 h-14 rounded-2xl grid place-items-center" style={{ background: 'var(--holo)' }}><XGlyph size={20} color="#0b0a12" /></div>
        <h1 className="font-serif text-3xl mb-2">Your portfolio</h1>
        <p className="text-[var(--color-ink-soft)] mb-7">Sign in with X to see the wallet minted for your account, its balance and every coin it holds.</p>
        <button onClick={connect} className="btn btn-primary mx-auto">Sign in with <XGlyph size={13} color="#fff" /></button>
      </div>
    )
  }

  const eth = folio?.eth ?? null
  const totalUsd = folio ? (ethUsd ? folio.totalWeth * ethUsd : null) : null
  const holdings = folio?.holdings ?? []

  return (
    <div className="max-w-3xl mx-auto">
      {/* header — real X identity */}
      <div className="flex items-center gap-3 mb-6">
        {wallet.avatar ? (
          <img src={wallet.avatar} alt="" className="w-12 h-12 rounded-full object-cover border hairline shrink-0" />
        ) : (
          <span className="orb-spin w-12 h-12 rounded-full grid place-items-center font-bold text-xl shrink-0"
            style={{ background: 'var(--holo)', color: '#0b0a12' }}>{(wallet.handle?.replace(/^@/, '')[0] || 'Y').toUpperCase()}</span>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-lg leading-tight truncate">{wallet.name || wallet.handle}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-sm text-[var(--color-ink-soft)] truncate">{wallet.handle}</span>
            <span className="inline-flex items-center gap-1 text-xs text-[var(--color-ink-soft)] shrink-0"><Verified size={13} /> Verified</span>
          </div>
        </div>
        <button onClick={() => nav('/settings')} className="grid place-items-center w-10 h-10 rounded-lg border hairline hover:bg-[var(--color-paper-2)] shrink-0"><Gear size={18} /></button>
      </div>

      {/* real wallet balance card */}
      <div className="card p-6 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-1">
            <div className="eyebrow mb-1">Total value</div>
            <div className="font-mono num text-3xl font-semibold">{totalUsd != null ? fmtUsd(totalUsd) : fmtEth(folio?.totalWeth)}</div>
            <div className="text-xs text-[var(--color-ink-faint)] mt-1">ETH + priced coins</div>
          </div>
          <Mini label="ETH balance" value={fmtEth(eth)} sub={ethUsd && eth != null ? fmtUsd(eth * ethUsd) : null} />
          <Mini label="Coins held" value={loading && !folio ? '…' : String(holdings.length)} sub={folio ? `of ${folio.scanned} scanned` : null} />
        </div>

        <div className="mt-5">
          <WalletActions />
        </div>
        <Link to="/launch" className="btn btn-holo static w-full justify-center mt-2">Launch a coin</Link>
      </div>

      {/* holdings — real coins in the wallet */}
      <div className="flex items-center justify-between mb-3">
        <div className="eyebrow">Holdings</div>
        <button onClick={load} disabled={loading} className="text-xs text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">{loading ? 'Reading…' : '↻ Refresh'}</button>
      </div>

      {holdings.length === 0 ? (
        <Empty
          title={loading ? 'Reading your wallet…' : 'No coins held'}
          subtitle={loading ? 'Scanning balances on Robinhood Chain.' : 'Coins you buy or launch will show up here, priced live.'}
          action={!loading && <Link to="/trade" className="btn btn-primary">Trade a coin</Link>}
        />
      ) : (
        <div className="card overflow-hidden">
          {holdings.map((h, i) => {
            const valueUsd = h.valueUsd ?? (h.valueWeth != null && ethUsd ? h.valueWeth * ethUsd : null)
            return (
              <Link key={h.token} to={`/trade?token=${h.token}`} className={`flex items-center gap-3 p-4 hover:bg-[var(--color-paper-2)] ${i ? 'border-t hairline' : ''}`}>
                <span className="w-9 h-9 grid place-items-center rounded-full panel-soft text-[var(--color-ink-soft)]"><Coin size={18} /></span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{h.name || `$${(h.symbol || '???').replace(/^\$/, '')}`}</div>
                  <div className="text-xs text-[var(--color-ink-faint)] font-mono num">{fmtQty(h.qty)} ${(h.symbol || 'TOKEN').replace(/^\$/, '')}</div>
                </div>
                <div className="text-right font-mono num font-medium">
                  {valueUsd != null ? fmtUsd(valueUsd) : h.valueWeth != null ? fmtEth(h.valueWeth) : '—'}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <p className="text-[11px] text-[var(--color-ink-faint)] mt-3">
        Coins are discovered by scanning on-chain transfers to your wallet, then reading each balance — launches, stock tokens and airdrops alike. A position from before the scanned window can still be missing; tap Refresh to rescan.
      </p>
    </div>
  )
}

function Mini({ label, value, sub }) {
  return (
    <div>
      <div className="eyebrow mb-1">{label}</div>
      <div className="font-mono num text-lg font-semibold">{value}</div>
      {sub && <div className="text-xs text-[var(--color-ink-faint)] mt-0.5">{sub}</div>}
    </div>
  )
}

function Empty({ title, subtitle, action }) {
  return (
    <div className="card text-center py-14 px-6">
      <div className="mx-auto mb-4 w-12 h-12 rounded-full border-2 border-dashed border-[var(--color-line-2)]" />
      <h3 className="font-serif text-2xl mb-1">{title}</h3>
      <p className="text-[var(--color-ink-soft)] max-w-xs mx-auto mb-5">{subtitle}</p>
      {action}
    </div>
  )
}
