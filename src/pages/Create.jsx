import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import CharmAvatar from '../components/CharmAvatar'

const EMOJIS = ['✨', '☁️', '🦊', '🌙', '🔮', '🦈', '🌵', '🪩', '🐉', '🍄', '👻', '🤖', '🦋', '🔥']
const VIBES = ['cozy', 'chaotic', 'dreamy', 'hype', 'spooky', 'poetic', 'retro', 'dry', 'loyal', 'playful']

export default function Create() {
  const nav = useNavigate()
  const { wallet, connect, launchCharm } = useStore()
  const [step, setStep] = useState(1)
  const [d, setD] = useState({ name: '', ticker: '', emoji: '✨', tagline: '', lore: '', voice: '', vibe: [] })

  const preview = { ...d, hue: 210, online: true, ticker: d.ticker || 'TICK', name: d.name || 'Your charm', emoji: d.emoji }
  const canLaunch = d.name.trim() && d.ticker.trim() && d.tagline.trim()

  function set(k, v) { setD((s) => ({ ...s, [k]: v })) }
  function toggleVibe(v) { setD((s) => ({ ...s, vibe: s.vibe.includes(v) ? s.vibe.filter((x) => x !== v) : [...s.vibe, v].slice(0, 4) })) }

  function launch() {
    if (!wallet) return connect('wallet')
    if (!canLaunch) return
    const charm = launchCharm(d)
    nav(`/c/${charm.id}`)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="font-serif text-4xl mb-1">Launch a charm</h1>
      <p className="text-[var(--color-ink-soft)] mb-6">Give it a soul and a coin. The timeline decides the rest.</p>

      <div className="grid md:grid-cols-[1fr_260px] gap-6">
        <div className="space-y-5">
          {/* identity */}
          <section className="card p-5">
            <h2 className="font-serif text-xl mb-3">1 · Identity</h2>
            <label className="block text-xs font-semibold text-[var(--color-ink-soft)] mb-1">Name</label>
            <input value={d.name} onChange={(e) => set('name', e.target.value)} maxLength={24}
              placeholder="e.g. Nimbus" className="w-full card !rounded-xl px-3 py-2.5 outline-none mb-3 focus:ring-2 ring-[var(--color-sky-deep)]" />

            <label className="block text-xs font-semibold text-[var(--color-ink-soft)] mb-1">Ticker</label>
            <input value={d.ticker} onChange={(e) => set('ticker', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="NIMB" className="w-full card !rounded-xl px-3 py-2.5 outline-none font-mono mb-3 focus:ring-2 ring-[var(--color-sky-deep)]" />

            <label className="block text-xs font-semibold text-[var(--color-ink-soft)] mb-1">Look</label>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map((e) => (
                <button key={e} onClick={() => set('emoji', e)} className={`w-10 h-10 rounded-xl text-xl grid place-items-center ${d.emoji === e ? 'bg-[var(--color-sky-deep)]' : 'bg-white/70 hover:bg-white'}`}>{e}</button>
              ))}
            </div>
          </section>

          {/* soul */}
          <section className="card p-5">
            <h2 className="font-serif text-xl mb-3">2 · Soul</h2>
            <label className="block text-xs font-semibold text-[var(--color-ink-soft)] mb-1">Tagline</label>
            <input value={d.tagline} onChange={(e) => set('tagline', e.target.value)} maxLength={80}
              placeholder="A one-line hook people will remember" className="w-full card !rounded-xl px-3 py-2.5 outline-none mb-3 focus:ring-2 ring-[var(--color-sky-deep)]" />

            <label className="block text-xs font-semibold text-[var(--color-ink-soft)] mb-1">Lore</label>
            <textarea value={d.lore} onChange={(e) => set('lore', e.target.value)} rows={3} maxLength={280}
              placeholder="Where did it come from? What does it want?" className="w-full card !rounded-xl px-3 py-2.5 outline-none mb-3 resize-none focus:ring-2 ring-[var(--color-sky-deep)]" />

            <label className="block text-xs font-semibold text-[var(--color-ink-soft)] mb-1">Voice</label>
            <input value={d.voice} onChange={(e) => set('voice', e.target.value)} maxLength={60}
              placeholder="How does it talk? e.g. warm, chaotic, deadpan" className="w-full card !rounded-xl px-3 py-2.5 outline-none mb-3 focus:ring-2 ring-[var(--color-sky-deep)]" />

            <label className="block text-xs font-semibold text-[var(--color-ink-soft)] mb-2">Vibe (pick up to 4)</label>
            <div className="flex flex-wrap gap-2">
              {VIBES.map((v) => (
                <button key={v} onClick={() => toggleVibe(v)} className={`chip ${d.vibe.includes(v) ? '!bg-[var(--color-ink)] !text-white' : ''}`}>#{v}</button>
              ))}
            </div>
          </section>

          <button onClick={launch} disabled={!canLaunch}
            className={`btn w-full ${canLaunch ? 'btn-primary' : 'btn-ghost opacity-60 cursor-not-allowed'}`}>
            {!wallet ? 'Connect wallet to launch' : canLaunch ? `Launch $${d.ticker || 'TICK'} →` : 'Fill in name, ticker & tagline'}
          </button>
          <p className="text-[10px] text-center text-[var(--color-ink-soft)]">
            Demo mint — no real token is created and no funds are spent.
          </p>
        </div>

        {/* live preview */}
        <div>
          <div className="card p-5 sticky top-20 text-center">
            <div className="text-xs font-semibold text-[var(--color-ink-soft)] mb-3 uppercase tracking-wide">Preview</div>
            <div className="flex justify-center mb-3"><CharmAvatar charm={preview} size={72} ring /></div>
            <div className="font-serif text-xl">{preview.name}</div>
            <div className="font-mono text-xs text-[var(--color-ink-soft)]">${preview.ticker}</div>
            <p className="text-sm text-[var(--color-ink-soft)] mt-2 min-h-[2.5rem]">{d.tagline || 'Your tagline appears here.'}</p>
            <div className="flex flex-wrap gap-1.5 justify-center mt-2">
              {d.vibe.map((v) => <span key={v} className="chip !py-0.5 !px-2 text-[10px]">#{v}</span>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
