import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import CharmAvatar, { TONES } from '../components/CharmAvatar'
import { XGlyph, Verified } from '../components/icons'

const VIBES = ['cozy', 'chaotic', 'dreamy', 'hype', 'spooky', 'poetic', 'retro', 'dry', 'loyal', 'playful']

export default function Create() {
  const nav = useNavigate()
  const { wallet, connect, launchCharm } = useStore()
  const [d, setD] = useState({ name: '', ticker: '', tone: TONES[0], tagline: '', lore: '', voice: '', vibe: [] })

  const preview = { ...d, online: true, ticker: d.ticker || 'TICK', name: d.name || 'Untitled' }
  const canLaunch = d.name.trim() && d.ticker.trim() && d.tagline.trim()

  function set(k, v) { setD((s) => ({ ...s, [k]: v })) }
  function toggleVibe(v) { setD((s) => ({ ...s, vibe: s.vibe.includes(v) ? s.vibe.filter((x) => x !== v) : [...s.vibe, v].slice(0, 4) })) }
  function launch() {
    if (!wallet) return connect()
    if (!canLaunch) return
    nav(`/c/${launchCharm(d).id}`)
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="font-serif text-4xl mb-1">Create a character</h1>
      <p className="text-[var(--color-ink-soft)] mb-8">Give it a name and a soul, then mint its coin.</p>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-6">
        <div className="space-y-5">
          <section className="card p-6">
            <h2 className="font-medium mb-4">Identity</h2>
            <label className="eyebrow block mb-1.5">Name</label>
            <input value={d.name} onChange={(e) => set('name', e.target.value)} maxLength={24} placeholder="Vanta" className="input mb-4" />
            <label className="eyebrow block mb-1.5">Ticker</label>
            <input value={d.ticker} onChange={(e) => set('ticker', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} placeholder="VNTA" className="input font-mono mb-4" />
            <label className="eyebrow block mb-2">Tone</label>
            <div className="flex flex-wrap gap-2.5">
              {TONES.map((t) => {
                const on = d.tone?.[0] === t[0]
                return (
                  <button key={t[0]} onClick={() => set('tone', t)} className="w-9 h-9 rounded-full transition-transform"
                    style={{
                      background: `radial-gradient(120% 120% at 32% 24%, ${t[0]}, ${t[1]} 60%, #0b0a14 130%)`,
                      boxShadow: on ? '0 0 0 2px var(--color-paper), 0 0 0 4px var(--color-accent)' : 'inset 0 1px 2px rgba(255,255,255,.3)',
                      transform: on ? 'scale(1.1)' : 'none',
                    }} aria-label="Tone" />
                )
              })}
            </div>
          </section>

          <section className="card p-6">
            <h2 className="font-medium mb-4">Soul</h2>
            <label className="eyebrow block mb-1.5">Tagline</label>
            <input value={d.tagline} onChange={(e) => set('tagline', e.target.value)} maxLength={80} placeholder="A one-line hook people remember" className="input mb-4" />
            <label className="eyebrow block mb-1.5">Lore</label>
            <textarea value={d.lore} onChange={(e) => set('lore', e.target.value)} rows={3} maxLength={280} placeholder="Where did it come from? What does it want?" className="input mb-4 resize-none" />
            <label className="eyebrow block mb-1.5">Voice</label>
            <input value={d.voice} onChange={(e) => set('voice', e.target.value)} maxLength={60} placeholder="warm, chaotic, deadpan…" className="input mb-4" />
            <label className="eyebrow block mb-2">Vibe · up to four</label>
            <div className="flex flex-wrap gap-2">
              {VIBES.map((v) => <button key={v} onClick={() => toggleVibe(v)} className={`chip ${d.vibe.includes(v) ? 'chip-brand' : 'hover:bg-[var(--color-line)]'}`}>{v}</button>)}
            </div>
          </section>

          <button onClick={launch} disabled={!!wallet && !canLaunch} className="btn btn-primary w-full !py-3">
            {!wallet ? (<><XGlyph size={13} color="#fff" /> Sign in with X to mint</>) : canLaunch ? `Mint $${d.ticker || 'TICK'}` : 'Fill in name, ticker & tagline'}
          </button>
          <p className="text-[11px] text-center text-[var(--color-ink-faint)]">Demo mint — no real token is created and no funds are spent.</p>
        </div>

        <div>
          <div className="card p-6 md:sticky md:top-24 text-center">
            <div className="eyebrow mb-4">Preview</div>
            <div className="flex justify-center mb-3"><CharmAvatar charm={preview} size={72} ring /></div>
            <div className="flex items-center justify-center gap-1.5">
              <span className="font-serif text-2xl">{preview.name}</span><Verified size={15} />
            </div>
            <div className="font-mono text-xs text-[var(--color-ink-faint)] mt-0.5">${preview.ticker}</div>
            <p className="text-sm text-[var(--color-ink-soft)] mt-3 min-h-[2.5rem]">{d.tagline || 'Your tagline appears here.'}</p>
            <div className="flex flex-wrap gap-1.5 justify-center mt-2">
              {d.vibe.map((v) => <span key={v} className="chip">{v}</span>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
