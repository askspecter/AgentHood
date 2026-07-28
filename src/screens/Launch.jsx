import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import CharmAvatar, { TONES } from '../components/CharmAvatar'
import { XGlyph, Verified, Back } from '../components/icons'

/**
 * Launch — create an agent, mint a real token on pons.
 *
 * The charms.ai-style creation flow (name → look → forge → soul → review) is the
 * theme; the deployment underneath is real. The factory's launch signature is
 * discovered from its verified ABI (/api/factory) and the nice fields here are
 * mapped onto it, then signed by your X wallet server-side (/api/launch/execute)
 * and recorded (/api/registry). One transaction, a real coin on Robinhood Chain.
 */

const NETWORK = 'robinhood'
const VIBES = ['cozy', 'chaotic', 'dreamy', 'hype', 'spooky', 'poetic', 'retro', 'dry', 'loyal', 'playful', 'ethereal', 'feral']
const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')
const friendly = (m) =>
  /SSL|EPROTO|handshake|allowlist|ECONN|ENOTFOUND|timeout|fetch|network|unreachable|502|server response/i.test(String(m || ''))
    ? "Couldn't reach Robinhood Chain right now — the pons factory is unavailable. Try again in a moment."
    : String(m || '')

const IDEAS = [
  { tagline: 'A sky-born oracle who answers only in weather.', lore: 'Drifted out of a forgotten group chat and refused to log off.', voice: 'warm, unbothered, cryptic' },
  { tagline: 'The tea-obsessed gremlin of the group chat.', lore: 'Knows everything about everyone and boils over at the first hint of gossip.', voice: 'chaotic, gleeful, nosy' },
  { tagline: 'An accountant ghost who audits your vibes.', lore: 'Died mid-spreadsheet and never clocked out.', voice: 'deadpan, precise, dry' },
  { tagline: 'A retired satellite that fell in love with the ground.', lore: 'Spent forty years watching Earth and finally came down to make friends.', voice: 'dreamy, tender, vast' },
]

/* Map the factory's discovered ABI fields onto the pretty inputs. */
function hintFor(field) {
  const n = field.name || ''
  if (/(feewallet|feerecipient|feeto|payout|creator)/i.test(n)) return { fillWithAccount: true }
  if (/(initialbuy|devbuy|firstbuy|buyamount)/i.test(n)) return { isEth: true }
  if (/^salt$/i.test(n)) return { fillWithSalt: true }
  return {}
}
function randomSalt() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return '0x' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function Pencil({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
      <path d="M4 20l1-4L16 5l3 3L8 19z" /><path d="M14 7l3 3" />
    </svg>
  )
}

export default function Launch() {
  const nav = useNavigate()
  const { wallet, connect } = useStore()
  const user = wallet ? { username: (wallet.handle || '').replace(/^@/, ''), id: wallet.id } : null

  const [step, setStep] = useState(0) // 0 name · 1 look · 2 forge · 3 soul · 4 review · 5 done
  const [pct, setPct] = useState(0)
  const [d, setD] = useState({ name: '', ticker: '', tone: TONES[0], logo: '', tagline: '', lore: '', voice: '', firstBuy: '', vibe: [] })

  const [meta, setMeta] = useState(null)
  const [metaError, setMetaError] = useState(null)
  const [xWallet, setXWallet] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const preview = { ...d, online: true, ticker: d.ticker || 'TICK', name: d.name || 'Untitled' }
  const canLaunch = d.name.trim() && d.tagline.trim()

  const set = (k, v) => setD((s) => ({ ...s, [k]: v }))
  const toggleVibe = (v) => setD((s) => ({ ...s, vibe: s.vibe.includes(v) ? s.vibe.filter((x) => x !== v) : [...s.vibe, v].slice(0, 4) }))
  const deriveTicker = (name) => name.replace(/[^A-Za-z0-9]/g, '').slice(0, 5).toUpperCase() || 'TICK'
  const idea = () => { const p = IDEAS[Math.floor(Math.random() * IDEAS.length)]; setD((s) => ({ ...s, tagline: p.tagline, lore: p.lore, voice: p.voice })) }

  // Discover the factory ABI + the X wallet up front, so the review step can mint
  // without any extra round trip.
  useEffect(() => {
    fetch(`/api/factory?network=${NETWORK}`)
      .then((r) => r.json())
      .then((json) => (json.error ? setMetaError(json.error) : setMeta(json)))
      .catch(() => setMetaError('Could not reach the factory endpoint.'))
    fetch(`/api/wallet?network=${NETWORK}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => { if (json?.address) setXWallet(json.address) })
      .catch(() => {})
  }, [user])

  const fields = useMemo(() => meta?.chosen?.fields || [], [meta])

  function next() {
    if (step === 0) { if (!d.ticker.trim()) set('ticker', deriveTicker(d.name)); setStep(1) }
    else if (step === 1) setStep(2)
    else if (step === 3) setStep(4)
  }
  function back() {
    if (step === 0) nav('/')
    else if (step === 3) setStep(1)
    else if (step === 4) setStep(3)
    else setStep((s) => Math.max(0, s - 1))
  }

  const describe = () => [d.tagline, d.vibe.length ? `Vibe: ${d.vibe.join(', ')}` : '', d.lore]
    .filter(Boolean).join(' · ').slice(0, 280)

  const doLaunch = useCallback(async () => {
    if (!user) return connect()
    if (!canLaunch || !meta?.chosen) return
    setBusy(true); setError(null)
    try {
      const values = {}
      for (const field of fields) {
        const n = field.name || ''
        const key = field.path.join('.')
        const hint = hintFor(field)
        if (/^(name|tokenname)$/i.test(n)) values[key] = d.name
        else if (/^(symbol|ticker)$/i.test(n)) values[key] = d.ticker
        else if (/(logo|image|icon|avatar|uri)/i.test(n)) { if (d.logo) values[key] = d.logo }
        else if (/(description|desc|bio)/i.test(n)) values[key] = describe()
        else if (hint.fillWithAccount) values[key] = xWallet
        else if (hint.isEth) { values[key] = d.firstBuy || '0'; values[`${key}__isEth`] = true }
        else if (hint.fillWithSalt) values[key] = randomSalt()
        // launchConfigId / dexId / socials left empty — the server encodes the
        // right defaults (0, and the fee wallet is forced to your X wallet).
      }
      const feePath = fields.find((f) => hintFor(f).fillWithAccount)?.path.join('.') || null
      const buyEth = Number(d.firstBuy || 0)

      const res = await fetch('/api/launch/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fnName: meta.chosen.name, fnInputs: meta.chosen.inputs, values, feePath, buyEth, network: NETWORK }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.hint ? `${json.error} ${json.hint}` : json.error || 'The launch failed.'); return }

      setResult({ txHash: json.hash, token: json.token })
      setStep(5)
      if (json.token) {
        fetch('/api/registry', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: json.token, txHash: json.hash, deployer: json.owner, xUsername: user.username }),
        }).catch(() => {})
      }
    } catch {
      setError('Could not reach the create endpoint.')
    } finally {
      setBusy(false)
    }
  }, [user, canLaunch, meta, fields, d, xWallet])

  // Forge animation → auto-advance to Soul.
  useEffect(() => {
    if (step !== 2) return
    setPct(0)
    const t0 = performance.now(), dur = 1700
    let raf
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur)
      setPct(Math.round(p * 100))
      if (p < 1) raf = requestAnimationFrame(tick)
      else raf = requestAnimationFrame(() => setTimeout(() => setStep(3), 260))
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [step])

  const progress = step === 2 ? 90 : step >= 4 ? 100 : [18, 60, 60, 100][step]

  return (
    <div className="max-w-xl mx-auto min-h-[74vh] flex flex-col">
      {step < 5 && (
        <div className="flex items-center gap-3 mb-8">
          <button onClick={back} aria-label="Back"
            className="grid place-items-center w-9 h-9 rounded-full border hairline hover:bg-[var(--color-paper-2)] transition">
            {step === 0 ? <Back size={17} /> : <Back size={17} />}
          </button>
          <div className="flex-1 h-1.5 rounded-full bg-[rgba(255,255,255,0.08)] overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: 'var(--holo-line)' }} />
          </div>
          <span className="eyebrow w-14 text-right">{step === 4 ? 'Final' : `${Math.min(step + 1, 3)}/3`}</span>
        </div>
      )}

      <div key={step} className="fade-up flex-1 flex flex-col">
        {step === 0 && <StepName d={d} set={set} onNext={next} />}
        {step === 1 && <StepLook d={d} preview={preview} set={set} onNext={next} />}
        {step === 2 && <StepForge preview={preview} pct={pct} />}
        {step === 3 && <StepSoul d={d} preview={preview} set={set} toggleVibe={toggleVibe} idea={idea} onNext={next} canLaunch={canLaunch} />}
        {step === 4 && <StepReview d={d} preview={preview} meta={meta} metaError={metaError} onEdit={() => setStep(0)} onLaunch={doLaunch} user={user} xWallet={xWallet} busy={busy} error={error} />}
        {step === 5 && <StepDone charm={preview} result={result} meta={meta} onTrade={() => nav(`/trade?token=${result?.token || ''}`)} />}
      </div>
    </div>
  )
}

/* ---------- 1 · Name ---------- */
function StepName({ d, set, onNext }) {
  return (
    <div className="flex-1 flex flex-col justify-center">
      <div className="eyebrow mb-3">Identity</div>
      <h1 className="display text-4xl sm:text-5xl mb-10">Name your agent.</h1>
      <div className="relative mb-8">
        <input autoFocus value={d.name} onChange={(e) => set('name', e.target.value.slice(0, 24))} placeholder="Vanta"
          className="w-full bg-transparent outline-none border-0 pb-3 text-4xl sm:text-5xl font-bold tracking-tight placeholder:text-[var(--color-ink-faint)]" />
        <span className="absolute left-0 bottom-0 h-[3px] w-full rounded-full" style={{ background: 'var(--holo-line)', opacity: 0.9 }} />
      </div>
      <label className="eyebrow block mb-2">Coin ticker <span className="text-[var(--color-ink-faint)] normal-case tracking-normal">· optional</span></label>
      <div className="flex items-center input !py-2.5 max-w-[220px] mb-10">
        <span className="text-[var(--color-ink-faint)] mr-1">$</span>
        <input value={d.ticker} onChange={(e) => set('ticker', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} placeholder="VNTA"
          className="w-full bg-transparent outline-none font-mono num text-lg border-0 p-0" />
      </div>
      <button onClick={onNext} disabled={!d.name.trim()} className="btn btn-holo w-full !py-3.5">Next</button>
    </div>
  )
}

/* ---------- 2 · Look ---------- */
function StepLook({ d, preview, set, onNext }) {
  return (
    <div className="flex-1 flex flex-col">
      <h1 className="display text-4xl sm:text-5xl text-center mb-2">What does<br />{d.name || 'it'} look like?</h1>
      <p className="text-center text-[var(--color-ink-soft)] mb-8">Pick a tone — its coin, aura and glow follow.</p>
      <div className="relative grid place-items-center mb-8">
        <div className="absolute w-56 h-56 rounded-full blur-3xl opacity-50 pointer-events-none" style={{ background: `radial-gradient(circle, ${d.tone[0]}, transparent 65%)` }} />
        <div className="floaty relative"><CharmAvatar charm={preview} size={160} ring /></div>
      </div>
      <div className="flex flex-wrap justify-center gap-3 mb-6">
        {TONES.map((t) => {
          const on = d.tone?.[0] === t[0]
          return (
            <button key={t[0]} onClick={() => set('tone', t)} aria-label="Tone" className="w-11 h-11 rounded-full transition-transform"
              style={{
                background: `radial-gradient(120% 120% at 32% 24%, ${t[0]}, ${t[1]} 60%, #0b0a14 130%)`,
                boxShadow: on ? '0 0 0 2px var(--color-paper), 0 0 0 4px #fff, 0 0 20px -4px ' + t[0] : 'inset 0 1px 2px rgba(255,255,255,.3)',
                transform: on ? 'scale(1.12)' : 'none',
              }} />
          )
        })}
      </div>
      <label className="eyebrow block mb-2">Logo image URL <span className="text-[var(--color-ink-faint)] normal-case tracking-normal">· optional, shown on pons</span></label>
      <input value={d.logo} onChange={(e) => set('logo', e.target.value.trim())} placeholder="https://… image URL" spellCheck={false} className="input mb-8" />
      <button onClick={onNext} className="btn btn-holo w-full !py-3.5 mt-auto">Forge {d.name || 'it'}</button>
    </div>
  )
}

/* ---------- 3 · Forge ---------- */
function StepForge({ preview, pct }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center">
      <div className="relative grid place-items-center mb-8">
        <div className="absolute w-64 h-64 rounded-full blur-3xl opacity-60 pointer-events-none" style={{ background: `radial-gradient(circle, ${preview.tone[0]}, transparent 62%)` }} />
        <div className="absolute rounded-full spin-slow pointer-events-none" style={{ width: 220, height: 220, border: '1px solid rgba(255,255,255,0.1)' }} />
        <div className="floaty relative"><CharmAvatar charm={preview} size={150} ring /></div>
      </div>
      <div className="font-mono num text-5xl font-bold holo-text">{pct}%</div>
      <div className="eyebrow mt-3">Forging {preview.name}…</div>
    </div>
  )
}

/* ---------- 4 · Soul ---------- */
function StepSoul({ d, preview, set, toggleVibe, idea, onNext, canLaunch }) {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex flex-col items-center text-center mb-7">
        <CharmAvatar charm={preview} size={72} ring />
        <div className="flex items-center gap-1.5 mt-3">
          <span className="font-serif text-2xl">{preview.name}</span><Verified size={15} />
          <span className="font-mono text-xs text-[var(--color-ink-faint)]">${preview.ticker}</span>
        </div>
        <h1 className="display text-3xl mt-4">Give {d.name || 'it'} a soul.</h1>
      </div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="eyebrow">Tagline · becomes the coin description</label>
        <button onClick={idea} className="chip chip-brand !py-1">✦ Idea</button>
      </div>
      <input value={d.tagline} onChange={(e) => set('tagline', e.target.value.slice(0, 80))} placeholder="A one-line hook people remember" className="input mb-5" />
      <label className="eyebrow block mb-2">Vibe · up to four</label>
      <div className="flex flex-wrap gap-2 mb-5">
        {VIBES.map((v) => <button key={v} onClick={() => toggleVibe(v)} className={`chip ${d.vibe.includes(v) ? 'chip-brand' : 'hover:bg-[var(--color-line)]'}`}>{v}</button>)}
      </div>
      <label className="eyebrow block mb-1.5">Story <span className="text-[var(--color-ink-faint)] normal-case tracking-normal">· optional</span></label>
      <textarea value={d.lore} onChange={(e) => set('lore', e.target.value.slice(0, 200))} rows={3} placeholder="Where did it come from? What does it want?" className="input resize-none mb-5" />
      <label className="eyebrow block mb-1.5">Your first buy (ETH) <span className="text-[var(--color-ink-faint)] normal-case tracking-normal">· optional</span></label>
      <input value={d.firstBuy} onChange={(e) => set('firstBuy', e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0" inputMode="decimal" className="input mb-6" />
      <button onClick={onNext} disabled={!canLaunch} className="btn btn-holo w-full !py-3.5">{canLaunch ? 'Review & launch' : 'Add a tagline to continue'}</button>
    </div>
  )
}

/* ---------- 5 · Review & launch (REAL) ---------- */
function StepReview({ d, preview, meta, metaError, onEdit, onLaunch, user, xWallet, busy, error }) {
  const fee = meta?.launchFeeEth
  return (
    <div className="flex-1 flex flex-col">
      <h1 className="display text-3xl sm:text-4xl text-center mb-7">One last look.</h1>

      <div className="glass card-glow rounded-3xl p-6 text-center relative overflow-hidden mb-6">
        <span className="pointer-events-none absolute inset-0 opacity-[0.06] font-serif text-[7rem] leading-none grid place-items-center select-none">{preview.ticker}</span>
        <div className="relative">
          <div className="flex justify-center mb-3"><CharmAvatar charm={preview} size={92} ring /></div>
          <div className="flex items-center justify-center gap-1.5">
            <span className="font-serif text-3xl">{preview.name}</span><Verified size={16} />
          </div>
          <div className="flex flex-wrap justify-center gap-1.5 mt-3">
            {d.vibe.slice(0, 4).map((v) => <span key={v} className="chip chip-brand">{v}</span>)}
            {d.tagline && <span className="chip max-w-[200px] truncate">{d.tagline}</span>}
          </div>
          <button onClick={onEdit} className="mt-5 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border hairline hover:bg-[var(--color-paper-2)] transition">
            <span className="font-mono num text-xl font-bold holo-text">${preview.ticker}</span>
            <span className="text-[var(--color-ink-soft)]"><Pencil /></span>
          </button>
        </div>
      </div>

      <div className="card p-4 mb-6 text-sm text-[var(--color-ink-soft)] space-y-1.5">
        <Row k="Network" v="Robinhood Chain · pons" />
        <Row k="Supply" v="1,000,000,000 (fixed)" />
        <Row k="Pool" v="Locked WETH · 1% fee" />
        {fee && <Row k="Launch fee" v={`${fee} ETH`} />}
        {Number(d.firstBuy) > 0 && <Row k="Your first buy" v={`${d.firstBuy} ETH`} />}
        {xWallet && <Row k="Creator fees →" v={short(xWallet)} />}
      </div>

      {metaError && <div className="chip chip-down w-full mb-4">Could not read the pons factory. {friendly(metaError)}</div>}
      {error && <div className="chip chip-down w-full mb-4">{friendly(error)}</div>}

      <button onClick={onLaunch} disabled={busy || !meta?.chosen} className="btn btn-holo w-full !py-3.5 mt-auto">
        {busy ? 'Minting on pons…' : !user ? (<>Sign in with <XGlyph size={13} color="#0b0a12" /> to launch</>) : !meta?.chosen ? 'Reading factory…' : `Launch ${preview.name} on pons`}
      </button>
      <p className="text-[11px] text-center text-[var(--color-ink-faint)] mt-3">
        Real launch — simulated first, signed by your X wallet, deployed through the pons factory.
      </p>
    </div>
  )
}
function Row({ k, v }) {
  return <div className="flex items-center justify-between"><span>{k}</span><span className="font-mono num text-[var(--color-ink)]">{v}</span></div>
}

/* ---------- 6 · Done (REAL result) ---------- */
function StepDone({ charm, result, meta, onTrade }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
      <div className="eyebrow mb-2">Live on pons</div>
      <h1 className="display text-4xl sm:text-5xl mb-2"><span className="holo-text">{charm.name}</span> is live.</h1>
      <p className="text-[var(--color-ink-soft)] mb-9">Minted on Robinhood Chain — it now appears on ponsfamily.com.</p>

      <div className="glass card-glow rounded-3xl p-8 w-full max-w-sm relative overflow-hidden mb-7">
        <span className="pointer-events-none absolute inset-x-0 bottom-2 text-center font-serif text-6xl opacity-[0.05] select-none">ESKA</span>
        <div className="relative flex flex-col items-center">
          <div className="absolute w-48 h-48 rounded-full blur-3xl opacity-50 pointer-events-none" style={{ background: `radial-gradient(circle, ${charm.tone?.[0] ?? '#8b7bff'}, transparent 65%)` }} />
          <div className="floaty relative"><CharmAvatar charm={{ ...charm, online: true }} size={128} ring /></div>
          <div className="flex items-center gap-1.5 mt-5">
            <span className="font-serif text-3xl">{charm.name}</span><Verified size={16} />
          </div>
          <div className="font-mono text-xs text-[var(--color-ink-faint)] mt-1">${charm.ticker}</div>
          {result?.token && <div className="font-mono text-[11px] text-[var(--color-ink-faint)] mt-2 break-all">{result.token}</div>}
        </div>
      </div>

      <div className="w-full max-w-sm space-y-2">
        {result?.token && <button onClick={onTrade} className="btn btn-holo w-full !py-3.5">Trade {charm.name}</button>}
        {meta?.explorer && result?.txHash && (
          <a href={`${meta.explorer}/tx/${result.txHash}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary w-full">View transaction ↗</a>
        )}
        <Link to="/" className="btn btn-ghost w-full">Back to Discover</Link>
      </div>
    </div>
  )
}
