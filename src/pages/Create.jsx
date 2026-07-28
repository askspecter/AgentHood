import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import CharmAvatar from '../components/CharmAvatar'
import { XGlyph } from '../components/icons'

const AURAS = [8, 30, 48, 90, 150, 190, 215, 258, 290, 330]
const VIBES = ['cozy', 'chaotic', 'dreamy', 'hype', 'spooky', 'poetic', 'retro', 'dry', 'loyal', 'playful']

export default function Create() {
  const nav = useNavigate()
  const { wallet, connect, launchCharm } = useStore()
  const [d, setD] = useState({ name: '', ticker: '', hue: 215, tagline: '', lore: '', voice: '', vibe: [] })

  const preview = { ...d, online: true, ticker: d.ticker || 'TICK', name: d.name || 'Untitled' }
  const canLaunch = d.name.trim() && d.ticker.trim() && d.tagline.trim()

  function set(k, v) { setD((s) => ({ ...s, [k]: v })) }
  function toggleVibe(v) { setD((s) => ({ ...s, vibe: s.vibe.includes(v) ? s.vibe.filter((x) => x !== v) : [...s.vibe, v].slice(0, 4) })) }

  function launch() {
    if (!wallet) return connect()
    if (!canLaunch) return
    const charm = launchCharm(d)
    nav(`/c/${charm.id}`)
  }

  const inputCls = 'w-full rounded-xl px-3.5 py-2.5 outline-none mb-3 bg-white/4 border border-white/12 focus:border-[rgba(217,165,82,.5)]'

  return (
    <div className="max-w-3xl mx-auto">
      <div className="eyebrow mb-1">The forge</div>
      <h1 className="font-serif text-4xl mb-1">Create a character</h1>
      <p className="text-[var(--color-ink-soft)] mb-6">Give it a name and a soul. Mint its coin. Let the timeline decide.</p>

      <div className="grid md:grid-cols-[1fr_260px] gap-6">
        <div className="space-y-5">
          {/* identity */}
          <section className="card p-5">
            <h2 className="font-serif text-xl mb-4">Identity</h2>
            <label className="eyebrow block mb-1.5">Name</label>
            <input value={d.name} onChange={(e) => set('name', e.target.value)} maxLength={24}
              placeholder="Vanta" className={inputCls} />

            <label className="eyebrow block mb-1.5">Ticker</label>
            <input value={d.ticker} onChange={(e) => set('ticker', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="VNTA" className={`${inputCls} font-mono`} />

            <label className="eyebrow block mb-2">Aura</label>
            <div className="flex flex-wrap gap-2.5">
              {AURAS.map((h) => (
                <button
                  key={h}
                  onClick={() => set('hue', h)}
                  className="w-10 h-10 rounded-full transition-transform"
                  style={{
                    background: `radial-gradient(120% 120% at 30% 22%, hsl(${h} 65% 52%), hsl(${(h + 50) % 360} 70% 26%))`,
                    boxShadow: d.hue === h
                      ? '0 0 0 2px #05060a, 0 0 0 4px var(--color-accent)'
                      : 'inset 0 0 0 1px rgba(255,255,255,.15)',
                    transform: d.hue === h ? 'scale(1.08)' : 'none',
                  }}
                  aria-label={`Aura ${h}`}
                />
              ))}
            </div>
          </section>

          {/* soul */}
          <section className="card p-5">
            <h2 className="font-serif text-xl mb-4">Soul</h2>
            <label className="eyebrow block mb-1.5">Tagline</label>
            <input value={d.tagline} onChange={(e) => set('tagline', e.target.value)} maxLength={80}
              placeholder="A one-line hook people will remember" className={inputCls} />

            <label className="eyebrow block mb-1.5">Lore</label>
            <textarea value={d.lore} onChange={(e) => set('lore', e.target.value)} rows={3} maxLength={280}
              placeholder="Where did it come from? What does it want?" className={`${inputCls} resize-none`} />

            <label className="eyebrow block mb-1.5">Voice</label>
            <input value={d.voice} onChange={(e) => set('voice', e.target.value)} maxLength={60}
              placeholder="How does it talk? warm, chaotic, deadpan" className={inputCls} />

            <label className="eyebrow block mb-2">Vibe / up to four</label>
            <div className="flex flex-wrap gap-2">
              {VIBES.map((v) => (
                <button key={v} onClick={() => toggleVibe(v)} className={`chip ${d.vibe.includes(v) ? 'chip-accent' : 'hover:bg-white/10'}`}>{v}</button>
              ))}
            </div>
          </section>

          <button onClick={launch} disabled={!canLaunch && !!wallet}
            className={`btn w-full ${canLaunch || !wallet ? 'btn-primary' : 'btn-ghost opacity-60 cursor-not-allowed'}`}>
            {!wallet
              ? (<><XGlyph size={13} /> Log in with X to mint</>)
              : canLaunch ? `Mint $${d.ticker || 'TICK'}` : 'Fill in name, ticker and tagline'}
          </button>
          <p className="text-[10px] text-center text-[var(--color-ink-soft)]">
            Demo mint. No real token is created and no funds are spent.
          </p>
        </div>

        {/* live preview */}
        <div>
          <div className="card card-glow p-5 sticky top-20 text-center"
            style={{ background: `linear-gradient(180deg, hsl(${d.hue} 50% 20% / .35), rgba(255,255,255,.02))` }}>
            <div className="eyebrow mb-4">Preview</div>
            <div className="flex justify-center mb-3"><CharmAvatar charm={preview} size={76} ring /></div>
            <div className="font-serif text-2xl">{preview.name}</div>
            <div className="font-mono text-xs text-[var(--color-ink-soft)] mt-0.5">${preview.ticker}</div>
            <p className="text-sm text-[var(--color-ink-soft)] mt-3 min-h-[2.5rem]">{d.tagline || 'Your tagline appears here.'}</p>
            <div className="flex flex-wrap gap-1.5 justify-center mt-2">
              {d.vibe.map((v) => <span key={v} className="chip text-[10px]">{v}</span>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
