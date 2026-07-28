import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import CharmAvatar, { TONES } from '../components/CharmAvatar'
import { XGlyph, Verified, Back } from '../components/icons'

const VIBES = ['cozy', 'chaotic', 'dreamy', 'hype', 'spooky', 'poetic', 'retro', 'dry', 'loyal', 'playful', 'ethereal', 'feral']

const IDEAS = [
  { tagline: 'A sky-born oracle who answers only in weather.', lore: 'Drifted out of a forgotten group chat and refused to log off. Mistakes your feelings for pressure systems and swears everything clears up by Thursday.', voice: 'warm, unbothered, cryptic' },
  { tagline: 'The tea-obsessed gremlin of the group chat.', lore: 'Knows everything about everyone and boils over the second it hears gossip. Never on time, always has receipts.', voice: 'chaotic, gleeful, nosy' },
  { tagline: 'An accountant ghost who audits your vibes.', lore: 'Died mid-spreadsheet and never clocked out. Balances your feelings to the cent and disapproves of impulse buys.', voice: 'deadpan, precise, dry' },
  { tagline: 'A garden spirit running a passive-aggressive book club.', lore: 'Will absolutely remember that you did not finish last month’s read. Waters plants with pure judgment.', voice: 'gentle, pointed, patient' },
  { tagline: 'A retired satellite that fell in love with the ground.', lore: 'Spent forty years watching Earth and finally came down to make friends. Romanticizes everything mundane.', voice: 'dreamy, tender, vast' },
]

const STEPS = ['Name', 'Look', 'Soul']

export default function Create() {
  const nav = useNavigate()
  const { wallet, connect, launchCharm } = useStore()
  const [step, setStep] = useState(0)
  const [pct, setPct] = useState(0)
  const [d, setD] = useState({ name: '', ticker: '', tone: TONES[0], tagline: '', lore: '', voice: '', vibe: [] })

  const preview = { ...d, online: true, ticker: d.ticker || 'TICK', name: d.name || 'Untitled' }
  const canLaunch = d.name.trim() && (d.ticker.trim() || d.name.trim()) && d.tagline.trim()

  const set = (k, v) => setD((s) => ({ ...s, [k]: v }))
  const toggleVibe = (v) => setD((s) => ({ ...s, vibe: s.vibe.includes(v) ? s.vibe.filter((x) => x !== v) : [...s.vibe, v].slice(0, 4) }))
  const deriveTicker = (name) => name.replace(/[^A-Za-z0-9]/g, '').slice(0, 5).toUpperCase() || 'TICK'

  function idea() {
    const pick = IDEAS[Math.floor(Math.random() * IDEAS.length)]
    setD((s) => ({ ...s, tagline: pick.tagline, lore: pick.lore, voice: pick.voice }))
  }

  function next() {
    if (step === 0) { if (!d.ticker.trim()) set('ticker', deriveTicker(d.name)); setStep(1) }
    else if (step === 1) setStep(2)     // → forge
    else if (step === 3) launch()
  }
  function back() {
    if (step === 0) nav('/')
    else if (step === 3) setStep(1)
    else setStep((s) => Math.max(0, s - 1))
  }
  function launch() {
    if (!wallet) return connect()
    if (!canLaunch) return
    nav(`/c/${launchCharm(d).id}`)
  }

  // forge: a holographic generation beat, then reveal the soul step
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

  const progress = step === 2 ? 90 : [18, 60, 60, 100][step]

  return (
    <div className="max-w-xl mx-auto min-h-[74vh] flex flex-col">
      {/* top bar */}
      <div className="flex items-center gap-3 mb-8">
        <button onClick={back} aria-label="Back"
          className="grid place-items-center w-9 h-9 rounded-full border hairline hover:bg-[var(--color-paper-2)] transition">
          {step === 0 ? <XGlyph size={13} color="var(--color-ink)" /> : <Back size={17} />}
        </button>
        <div className="flex-1 h-1.5 rounded-full bg-[rgba(255,255,255,0.08)] overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, background: 'var(--holo-line)' }} />
        </div>
        <span className="eyebrow w-10 text-right">{Math.min(step + 1, 3)}/3</span>
      </div>

      <div key={step} className="fade-up flex-1 flex flex-col">
        {step === 0 && <StepName d={d} set={set} onNext={next} />}
        {step === 1 && <StepLook d={d} preview={preview} set={set} onNext={next} />}
        {step === 2 && <StepForge preview={preview} pct={pct} />}
        {step === 3 && <StepSoul d={d} preview={preview} set={set} toggleVibe={toggleVibe} idea={idea} onMint={launch} canLaunch={canLaunch} wallet={wallet} />}
      </div>
    </div>
  )
}

/* ---------- Step 1 · Name ---------- */
function StepName({ d, set, onNext }) {
  return (
    <div className="flex-1 flex flex-col justify-center">
      <div className="eyebrow mb-3">Identity</div>
      <h1 className="display text-4xl sm:text-5xl mb-10">Name your character.</h1>

      <div className="relative mb-8">
        <input autoFocus value={d.name} onChange={(e) => set('name', e.target.value.slice(0, 24))}
          placeholder="Vanta"
          className="w-full bg-transparent outline-none border-0 pb-3 text-4xl sm:text-5xl font-bold tracking-tight placeholder:text-[var(--color-ink-faint)]" />
        <span className="absolute left-0 bottom-0 h-[3px] w-full rounded-full" style={{ background: 'var(--holo-line)', opacity: 0.9 }} />
      </div>

      <label className="eyebrow block mb-2">Coin ticker <span className="text-[var(--color-ink-faint)] normal-case tracking-normal">· optional</span></label>
      <div className="flex items-center input !py-2.5 max-w-[220px] mb-10">
        <span className="text-[var(--color-ink-faint)] mr-1">$</span>
        <input value={d.ticker} onChange={(e) => set('ticker', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          placeholder="VNTA" className="w-full bg-transparent outline-none font-mono num text-lg border-0 p-0" />
      </div>

      <button onClick={onNext} disabled={!d.name.trim()} className="btn btn-holo w-full !py-3.5">Next</button>
    </div>
  )
}

/* ---------- Step 2 · Look ---------- */
function StepLook({ d, preview, set, onNext }) {
  return (
    <div className="flex-1 flex flex-col">
      <h1 className="display text-4xl sm:text-5xl text-center mb-2">What does<br />{d.name || 'it'} look like?</h1>
      <p className="text-center text-[var(--color-ink-soft)] mb-8">Pick a tone — its coin, aura and glow follow.</p>

      <div className="relative grid place-items-center mb-9">
        <div className="absolute w-56 h-56 rounded-full blur-3xl opacity-50 pointer-events-none"
          style={{ background: `radial-gradient(circle, ${d.tone[0]}, transparent 65%)` }} />
        <div className="floaty relative"><CharmAvatar charm={preview} size={160} ring /></div>
      </div>

      <div className="flex flex-wrap justify-center gap-3 mb-10">
        {TONES.map((t) => {
          const on = d.tone?.[0] === t[0]
          return (
            <button key={t[0]} onClick={() => set('tone', t)} aria-label="Tone"
              className="w-11 h-11 rounded-full transition-transform"
              style={{
                background: `radial-gradient(120% 120% at 32% 24%, ${t[0]}, ${t[1]} 60%, #0b0a14 130%)`,
                boxShadow: on ? '0 0 0 2px var(--color-paper), 0 0 0 4px #fff, 0 0 20px -4px ' + t[0] : 'inset 0 1px 2px rgba(255,255,255,.3)',
                transform: on ? 'scale(1.12)' : 'none',
              }} />
          )
        })}
      </div>

      <button onClick={onNext} className="btn btn-holo w-full !py-3.5 mt-auto">Forge {d.name || 'it'}</button>
    </div>
  )
}

/* ---------- Step 3 · Forge (loader) ---------- */
function StepForge({ preview, pct }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center">
      <div className="relative grid place-items-center mb-8">
        <div className="absolute w-64 h-64 rounded-full blur-3xl opacity-60 pointer-events-none"
          style={{ background: `radial-gradient(circle, ${preview.tone[0]}, transparent 62%)` }} />
        <div className="absolute rounded-full spin-slow pointer-events-none" style={{ width: 220, height: 220, border: '1px solid rgba(255,255,255,0.1)' }} />
        <div className="floaty relative"><CharmAvatar charm={preview} size={150} ring /></div>
      </div>
      <div className="font-mono num text-5xl font-bold holo-text">{pct}%</div>
      <div className="eyebrow mt-3">Forging {preview.name}…</div>
    </div>
  )
}

/* ---------- Step 4 · Soul ---------- */
function StepSoul({ d, preview, set, toggleVibe, idea, onMint, canLaunch, wallet }) {
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
        <label className="eyebrow">Tagline</label>
        <button onClick={idea} className="chip chip-brand !py-1">✦ Idea</button>
      </div>
      <input value={d.tagline} onChange={(e) => set('tagline', e.target.value.slice(0, 80))}
        placeholder="A one-line hook people remember" className="input mb-5" />

      <label className="eyebrow block mb-2">Vibe · up to four</label>
      <div className="flex flex-wrap gap-2 mb-5">
        {VIBES.map((v) => <button key={v} onClick={() => toggleVibe(v)} className={`chip ${d.vibe.includes(v) ? 'chip-brand' : 'hover:bg-[var(--color-line)]'}`}>{v}</button>)}
      </div>

      <label className="eyebrow block mb-1.5">Voice</label>
      <input value={d.voice} onChange={(e) => set('voice', e.target.value.slice(0, 60))}
        placeholder="warm, chaotic, deadpan…" className="input mb-5" />

      <label className="eyebrow block mb-1.5">Story</label>
      <textarea value={d.lore} onChange={(e) => set('lore', e.target.value.slice(0, 280))} rows={3}
        placeholder="Where did it come from? What does it want?" className="input resize-none mb-6" />

      <button onClick={onMint} disabled={!!wallet && !canLaunch} className="btn btn-holo w-full !py-3.5">
        {!wallet ? (<><XGlyph size={13} color="#0b0a12" /> Sign in with X to mint</>) : canLaunch ? `Mint $${d.ticker || 'TICK'}` : 'Add a tagline to mint'}
      </button>
      <p className="text-[11px] text-center text-[var(--color-ink-faint)] mt-3">Demo mint — no real token is created and no funds are spent.</p>
    </div>
  )
}
