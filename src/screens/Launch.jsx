import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

/* Name suggestions for the Idea button on step one. */
const NAME_IDEAS = ['Vanta', 'Lumen', 'Onyx', 'Halcyon', 'Nyx', 'Ember', 'Cobalt', 'Seraph', 'Vesper', 'Zephyr', 'Marrow', 'Quill']

/* Appearance prompts the Idea button drops into the look description. When the AI
   image API is wired, these are exactly the kind of prompt it will render from. */
const LOOK_IDEAS = [
  'A glossy chrome sphere with a single glowing eye, violet rim light, floating in soft fog.',
  'A tiny round mascot with big eyes and a holographic hoodie, pastel gradient, sticker style.',
  'A carved obsidian talisman with molten gold cracks, dramatic side lighting on black.',
  'A translucent jellyfish-orb trailing neon ribbons, deep-space background, dreamy bloom.',
  'A retro pixel creature, 16-bit, mint and cyan palette, crisp dark backdrop.',
]

/* Visual styles for the look step. Each sets the coin's tone (its aura/glow) and
   a matching vibe. Deliberately ESKA's own set, not a copy of anyone else's. */
/* The style gallery — each tile shows an AI preview (via /api/ai/style-preview)
   and its prompt fragment (p) steers the coin's own logo generation. Keys must
   match STYLE_PROMPTS in the style-preview endpoint. */
const STYLE_DEFS = [
  { key: 'realistic', label: 'Realistic', p: 'photorealistic, ultra detailed', vibe: 'blue-chip' },
  { key: 'anime', label: 'Anime', p: 'anime style, clean cel shading', vibe: 'playful' },
  { key: 'pixel', label: 'Pixel Art', p: '16-bit pixel art, retro sprite', vibe: 'retro' },
  { key: 'ps2', label: 'PS2', p: 'PS2-era low-poly 3D render', vibe: 'retro' },
  { key: 'lineart', label: 'Line Art', p: 'clean black and white line art', vibe: 'dry' },
  { key: 'cyberpunk', label: 'Cyberpunk', p: 'cyberpunk, neon, futuristic', vibe: 'hype' },
  { key: 'mascot', label: 'Mascot', p: 'cute glossy 3D mascot', vibe: 'playful' },
  { key: 'film', label: 'Film', p: 'cinematic film still, dramatic lighting', vibe: 'poetic' },
  { key: 'comic', label: 'Comic Book', p: 'comic book art, bold ink, halftone', vibe: 'chaotic' },
  { key: 'ethereal', label: 'Ethereal', p: 'ethereal, dreamy, soft glow', vibe: 'ethereal' },
  { key: 'fantasy', label: 'Fantasy', p: 'epic fantasy, glowing runes, ornate', vibe: 'dreamy' },
  { key: 'dark', label: 'Dark', p: 'dark moody, dramatic shadows', vibe: 'spooky' },
  { key: 'cartoon', label: 'Cartoon', p: '3D cartoon, Pixar-like, colorful', vibe: 'cozy' },
  { key: 'manhwa', label: 'Manhwa', p: 'korean manhwa webtoon style', vibe: 'loyal' },
  { key: 'vaporwave', label: 'Vaporwave', p: 'vaporwave, pastel neon, retro 80s', vibe: 'dreamy' },
  { key: 'chibi', label: 'Chibi', p: 'chibi, super deformed, cute', vibe: 'playful' },
  { key: 'ghibli', label: 'Ghibli', p: 'studio ghibli inspired, soft watercolor', vibe: 'cozy' },
]
const STYLES = STYLE_DEFS.map((s, i) => ({ ...s, tone: TONES[i % TONES.length] }))

const GENDERS = [
  { key: 'masc', label: 'He', glyph: '♂' },
  { key: 'fem', label: 'She', glyph: '♀' },
  { key: 'neutral', label: 'They', glyph: '⬦' },
]

/* Personality traits offered on the Soul step. The "more" button reshuffles which
   ones are shown; when the AI API lands it can suggest tailored traits instead. */
const PERSONALITY_POOL = [
  'Observes from the shadows before it acts',
  'Calm on the inside, chaos on the outside',
  'Deeply loyal once you earn it',
  'Speaks in one-liners and riddles',
  'Values independence above all',
  'Runs hot, forgives fast',
  'Overthinks everything, admits nothing',
  'Treats every trade like a story',
  'Secretly sentimental about its holders',
  'Allergic to being ignored',
  'Keeps score, never says so',
  'Believes it is destined to graduate',
]
function shuffled(arr, seed) {
  const a = [...arr]
  let h = seed || 1
  for (let i = a.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) & 0x7fffffff
    const j = h % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* Shrink a picked image to a small square data URL — the real logo shown on pons. */
function fileToLogo(file, size = 256) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = size
        const ctx = canvas.getContext('2d')
        const s = Math.min(img.width, img.height)
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

/* ---- AI helpers (server-side keys). Both fail soft: on any error they return
   null and the caller uses its built-in fallback, so the buttons always work. */
async function aiIdea(kind, context = {}) {
  try {
    const res = await fetch('/api/ai/idea', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, context }),
    })
    if (!res.ok) return null
    return await res.json() // { items } for name/personality, { text } otherwise
  } catch { return null }
}
async function aiImage(prompt, style) {
  try {
    const res = await fetch('/api/ai/image', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, style }),
    })
    if (!res.ok) return null
    const j = await res.json()
    return j.url || null
  } catch { return null }
}
const styleLabel = (key) => STYLES.find((s) => s.key === key)?.label || ''

/* Store an image (data URL or remote URL) durably and get back a stable URL for
   on-chain metadata. Returns null if storage isn't configured — callers keep the
   original source as a fallback. */
async function persistLogo(source) {
  try {
    const res = await fetch('/api/logo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source }),
    })
    if (!res.ok) return null
    const j = await res.json()
    return j.url || null
  } catch { return null }
}

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

  const [step, setStep] = useState(0) // 0 name · 1 look · 2 forge/ready · 3 soul · 4 review · 5 done
  const [pct, setPct] = useState(0)
  const [d, setD] = useState({ name: '', ticker: '', tone: TONES[0], logo: '', tagline: '', lore: '', voice: '', firstBuy: '', vibe: [], personality: [], gender: '', style: '', look: '', tickerEdited: false })

  const [meta, setMeta] = useState(null)
  const [metaError, setMetaError] = useState(null)
  const [retryKey, setRetryKey] = useState(0)
  const [xWallet, setXWallet] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const preview = { ...d, online: false, ticker: d.ticker || 'TICK', name: d.name || 'Untitled' }
  // A name is the only hard requirement; the ticker is derived and the "soul"
  // fields are all optional flavour that feed the coin's description.
  const canLaunch = !!d.name.trim()

  const set = (k, v) => setD((s) => ({ ...s, [k]: v }))
  const toggleVibe = (v) => setD((s) => ({ ...s, vibe: s.vibe.includes(v) ? s.vibe.filter((x) => x !== v) : [...s.vibe, v].slice(0, 5) }))
  const togglePersonality = (p) => setD((s) => ({ ...s, personality: s.personality.includes(p) ? s.personality.filter((x) => x !== p) : [...s.personality, p].slice(0, 3) }))
  // AI-button state (per-button busy flags).
  const [nameBusy, setNameBusy] = useState(false)
  const [lookBusy, setLookBusy] = useState(false)
  const [soulBusy, setSoulBusy] = useState(false)
  const [aiTraits, setAiTraits] = useState(null)
  const [traitBusy, setTraitBusy] = useState(false)

  // Ticker derived from the name (letters/digits, up to 5). Empty name → empty.
  const autoTicker = (name) => (name || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 5).toUpperCase()
  const deriveTicker = (name) => autoTicker(name) || 'TICK'

  // Typing the name keeps the ticker in step, unless the user set one by hand.
  const setName = (v) => setD((s) => ({ ...s, name: v.slice(0, 24), ticker: s.tickerEdited ? s.ticker : autoTicker(v) }))
  const setTicker = (v) => setD((s) => ({ ...s, ticker: v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6), tickerEdited: true }))

  // GPT-4o-mini for the Idea / more buttons; each falls back to a local list.
  // Name Idea drops ONE original name straight in, and the ticker follows it.
  const nameIdea = useCallback(async () => {
    setNameBusy(true)
    const r = await aiIdea('name', { hint: styleLabel(d.style) })
    const name = (r?.text || NAME_IDEAS[Math.floor(Math.random() * NAME_IDEAS.length)])
      .replace(/^["'\s]+|["'\s.]+$/g, '').slice(0, 24)
    setD((s) => ({ ...s, name, ticker: s.tickerEdited ? s.ticker : autoTicker(name) }))
    setNameBusy(false)
  }, [d.style])

  const lookIdea = useCallback(async () => {
    setLookBusy(true)
    const r = await aiIdea('look', { name: d.name, style: styleLabel(d.style) })
    set('look', r?.text || LOOK_IDEAS[Math.floor(Math.random() * LOOK_IDEAS.length)])
    setLookBusy(false)
  }, [d.name, d.style])

  const idea = useCallback(async () => {
    setSoulBusy(true)
    const r = await aiIdea('tagline', { name: d.name, vibe: d.vibe.join(', ') })
    set('lore', r?.text || IDEAS[Math.floor(Math.random() * IDEAS.length)].lore)
    setSoulBusy(false)
  }, [d.name, d.vibe])

  const moreTraits = useCallback(async () => {
    setTraitBusy(true)
    const r = await aiIdea('personality', { name: d.name, vibe: d.vibe.join(', ') })
    const ok = !!(r?.items?.length)
    setAiTraits(ok ? r.items.slice(0, 6) : null)
    setTraitBusy(false)
    return ok
  }, [d.name, d.vibe])

  const pickStyle = (st) => setD((s) => ({ ...s, style: st.key, tone: st.tone, vibe: [...new Set([st.vibe, ...s.vibe])].slice(0, 5) }))
  const setLogoFromFile = async (file) => {
    try {
      const dataUrl = await fileToLogo(file)
      set('logo', dataUrl) // instant preview
      // Persist to KV so the on-chain logo is a stable URL, not a huge data URL.
      const r = await persistLogo(dataUrl)
      if (r) set('logo', r)
    } catch { /* ignore unreadable image */ }
  }

  // Discover the factory ABI + the X wallet up front, so the review step can mint
  // without any extra round trip. The factory read depends on the block explorer,
  // which occasionally hiccups — so retry a few times with backoff before showing
  // an error, and let the user retry without reloading. Most blips resolve
  // themselves and are never seen.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setMetaError(null)
      for (let i = 0; i < 4; i++) {
        try {
          const r = await fetch(`/api/factory?network=${NETWORK}`)
          const json = await r.json()
          if (cancelled) return
          if (!json.error) { setMeta(json); setMetaError(null); return }
          if (i === 3) { setMetaError(json.error); return }
        } catch {
          if (cancelled) return
          if (i === 3) { setMetaError('Could not reach the factory endpoint.'); return }
        }
        await new Promise((res) => setTimeout(res, 800 * (i + 1)))
      }
    })()
    fetch(`/api/wallet?network=${NETWORK}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => { if (json?.address) setXWallet(json.address) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user, retryKey])

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

  const describe = () => [
    d.tagline,
    d.vibe.length ? `Vibe: ${d.vibe.join(', ')}` : '',
    d.personality.length ? d.personality.join('. ') : '',
    d.lore, d.look,
  ].filter(Boolean).join(' · ').slice(0, 280)

  const doLaunch = useCallback(async () => {
    if (!user) return connect()
    if (!canLaunch || !meta?.chosen) return
    setBusy(true); setError(null)
    try {
      // Ensure the logo is a durable, self-hosted URL before it goes on-chain —
      // never a temporary fal URL or a huge data URL.
      let logo = d.logo
      if (logo && !/\/api\/logo\?id=/.test(logo)) {
        const stable = await persistLogo(logo)
        if (stable) { logo = stable; set('logo', stable) }
      }
      // Launch on pons v1: map the pretty fields onto the factory's discovered
      // ABI and sign server-side. (v2 launching is whitelist-gated during its
      // audit; trading still auto-detects v2 vs v1 per token.)
      const values = {}
      for (const field of fields) {
        const n = field.name || ''
        const key = field.path.join('.')
        const hint = hintFor(field)
        if (/^(name|tokenname)$/i.test(n)) values[key] = d.name
        else if (/^(symbol|ticker)$/i.test(n)) values[key] = d.ticker
        else if (/(logo|image|icon|avatar|uri)/i.test(n)) { if (logo) values[key] = logo }
        else if (/(description|desc|bio)/i.test(n)) values[key] = describe()
        else if (hint.fillWithAccount) values[key] = xWallet
        else if (hint.isEth) { values[key] = d.firstBuy || '0'; values[`${key}__isEth`] = true }
        else if (hint.fillWithSalt) values[key] = randomSalt()
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

  // "Generating the look": kick off FLUX.1 [schnell] on fal.ai and animate the
  // progress. The bar eases toward ~94% while the image renders, then snaps to
  // 100% and shows the ready card. If the user already uploaded an image, or no
  // image key is set, it skips generation and just finishes — the procedural
  // avatar stands in, so the flow never blocks.
  useEffect(() => {
    if (step !== 2) return
    let cancelled = false, ready = false
    setPct(0)
    // The subject only — the server slots this into the chosen style's template,
    // so the style fragment is no longer merged in here (it owns the render).
    const subject = [
      d.name,
      d.gender && GENDERS.find((g) => g.key === d.gender)?.label,
      d.look,
    ].filter(Boolean).join(', ')
    const needGen = !d.logo && (!!subject || !!d.style)
    const job = needGen ? aiImage(subject, d.style) : Promise.resolve(null)
    job.then((url) => { if (!cancelled && url) set('logo', url) }).catch(() => {}).finally(() => { ready = true })

    const t0 = performance.now()
    let raf
    const tick = (now) => {
      if (cancelled) return
      const t = (now - t0) / 1000
      let target
      if (ready) target = t < 0.7 ? Math.min(94, 100 * (1 - Math.exp(-t / 0.5))) : 100
      else target = Math.min(94, 100 * (1 - Math.exp(-t / 1.0)))
      setPct(Math.round(target))
      if (!(ready && target >= 100)) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelled = true; cancelAnimationFrame(raf) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        {step === 0 && <StepName d={d} setName={setName} setTicker={setTicker} onNext={next} nameIdea={nameIdea} nameBusy={nameBusy} />}
        {step === 1 && <StepLook d={d} preview={preview} set={set} onNext={next} pickStyle={pickStyle} lookIdea={lookIdea} lookBusy={lookBusy} setLogoFromFile={setLogoFromFile} />}
        {step === 2 && <StepForge preview={preview} pct={pct} onContinue={() => setStep(3)} onEdit={() => setStep(1)} />}
        {step === 3 && <StepSoul d={d} preview={preview} set={set} toggleVibe={toggleVibe} togglePersonality={togglePersonality} idea={idea} soulBusy={soulBusy} aiTraits={aiTraits} moreTraits={moreTraits} traitBusy={traitBusy} onNext={next} canLaunch={canLaunch} />}
        {step === 4 && <StepReview d={d} preview={preview} meta={meta} metaError={metaError} onEdit={() => setStep(0)} onLaunch={doLaunch} user={user} xWallet={xWallet} busy={busy} error={error} />}
        {step === 5 && <StepDone charm={preview} result={result} meta={meta} onTrade={() => nav(`/c/${result?.token || ''}`)} />}
      </div>
    </div>
  )
}

/* ---------- 1 · Name ---------- */
function StepName({ d, setName, setTicker, onNext, nameIdea, nameBusy }) {
  return (
    <div className="flex-1 flex flex-col justify-center">
      <div className="eyebrow mb-3">Identity</div>
      <h1 className="display text-4xl sm:text-5xl mb-10">Name your agent.</h1>
      <div className="relative mb-8">
        <div className="flex items-end gap-3">
          <input autoFocus value={d.name} onChange={(e) => setName(e.target.value)} placeholder="Vanta"
            className="flex-1 min-w-0 bg-transparent outline-none border-0 pb-3 text-4xl sm:text-5xl font-bold tracking-tight placeholder:text-[var(--color-ink-faint)]" />
          <button onClick={nameIdea} disabled={nameBusy} className="chip chip-brand shrink-0 mb-3 !py-1.5">{nameBusy ? '…' : '✦ Idea'}</button>
        </div>
        <span className="absolute left-0 bottom-0 h-[3px] w-full rounded-full" style={{ background: 'var(--holo-line)', opacity: 0.9 }} />
      </div>
      <label className="eyebrow block mb-2">Coin ticker <span className="text-[var(--color-ink-faint)] normal-case tracking-normal">· follows the name</span></label>
      <div className="flex items-center input !py-2.5 max-w-[220px] mb-10">
        <span className="text-[var(--color-ink-faint)] mr-1">$</span>
        <input value={d.ticker} onChange={(e) => setTicker(e.target.value)} placeholder="VNTA"
          className="w-full bg-transparent outline-none font-mono num text-lg border-0 p-0" />
      </div>
      <button onClick={onNext} disabled={!d.name.trim()} className="btn btn-holo w-full !py-3.5">Next</button>
    </div>
  )
}

/* ---------- 2 · Look ---------- */
function ChipBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium border transition ${
        active ? 'chip-brand border-transparent' : 'border-[var(--color-line-2)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
      }`}>
      {children}
    </button>
  )
}

/* A style tile: an AI-generated preview over a tinted gradient. If the preview
   can't load (no image key / not generated yet) the gradient stands in. */
function StyleTile({ st, on, onClick }) {
  const [broken, setBroken] = useState(false)
  return (
    <button onClick={onClick} className="shrink-0 text-center">
      <span className="block w-16 h-16 rounded-2xl mb-1.5 overflow-hidden relative transition-transform" style={{
        background: `radial-gradient(120% 120% at 32% 22%, ${st.tone[0]}, ${st.tone[1]} 58%, #0b0a14 130%)`,
        boxShadow: on ? `0 0 0 2px var(--color-paper), 0 0 0 4px #fff, 0 0 22px -4px ${st.tone[0]}` : 'inset 0 1px 2px rgba(255,255,255,.3)',
        transform: on ? 'scale(1.06)' : 'none',
      }}>
        {!broken && (
          <img src={`/api/ai/style-preview?style=${st.key}`} alt="" loading="lazy"
            className="absolute inset-0 w-full h-full object-cover" onError={() => setBroken(true)} />
        )}
      </span>
      <span className={`block text-[11px] ${on ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-faint)]'}`}>{st.label}</span>
    </button>
  )
}

function StepLook({ d, preview, set, onNext, pickStyle, lookIdea, lookBusy, setLogoFromFile }) {
  const [open, setOpen] = useState(null) // 'gender' | 'style' | 'image' | null
  const fileRef = useRef(null)
  const toggle = (k) => setOpen((o) => (o === k ? null : k))
  const onFile = async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) await setLogoFromFile(f) }

  return (
    <div className="flex-1 flex flex-col">
      {/* glowing orb + preview */}
      <div className="relative grid place-items-center mb-7 mt-1">
        <div className="absolute w-52 h-52 rounded-full blur-3xl opacity-60 pointer-events-none" style={{ background: `radial-gradient(circle, ${d.tone[0]}, transparent 62%)` }} />
        <div className="floaty relative"><CharmAvatar charm={preview} size={150} ring square /></div>
      </div>

      <h1 className="display text-3xl sm:text-4xl text-center mb-6">What does {d.name || 'it'} look like?</h1>

      <div className="card p-4 sm:p-5">
        {/* chips */}
        <div className="flex flex-wrap gap-2 mb-3">
          <ChipBtn active={open === 'gender'} onClick={() => toggle('gender')}>
            {open === 'gender' ? '✕' : '☺'} {d.gender ? GENDERS.find((g) => g.key === d.gender)?.label : 'Gender'}
          </ChipBtn>
          <ChipBtn active={open === 'style'} onClick={() => toggle('style')}>
            {open === 'style' ? '✕' : '◐'} {d.style ? STYLES.find((s) => s.key === d.style)?.label : 'Style'}
          </ChipBtn>
          <ChipBtn active={open === 'image' || !!d.logo} onClick={() => toggle('image')}>
            {d.logo ? '✓' : '⌾'} Image
          </ChipBtn>
        </div>

        {/* expandable panel */}
        {open === 'gender' && (
          <div className="flex flex-wrap gap-2 mb-3 fade-up">
            {GENDERS.map((g) => (
              <button key={g.key} onClick={() => { set('gender', d.gender === g.key ? '' : g.key) }}
                className={`chip ${d.gender === g.key ? 'chip-brand' : 'hover:bg-[var(--color-line)]'}`}>
                <span className="mr-0.5">{g.glyph}</span> {g.label}
              </button>
            ))}
          </div>
        )}
        {open === 'style' && (
          <div className="-mx-4 sm:-mx-5 px-4 sm:px-5 mb-3 fade-up">
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
              {STYLES.map((st) => (
                <StyleTile key={st.key} st={st} on={d.style === st.key} onClick={() => pickStyle(st)} />
              ))}
            </div>
          </div>
        )}
        {open === 'image' && (
          <div className="mb-3 fade-up flex items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
            <button onClick={() => fileRef.current?.click()} className="btn btn-secondary !py-2 text-sm">{d.logo ? 'Change image' : 'Upload image'}</button>
            {d.logo && <button onClick={() => set('logo', '')} className="btn btn-ghost !py-2 text-sm text-[var(--color-ink-soft)]">Remove</button>}
            <span className="text-xs text-[var(--color-ink-faint)]">Shown as the coin logo on pons</span>
          </div>
        )}

        {/* appearance description */}
        <div className="relative">
          <textarea value={d.look} onChange={(e) => set('look', e.target.value.slice(0, 240))} rows={3}
            placeholder={`Pick a style, then describe ${d.name || 'it'}: colors, symbol, mood, details.`}
            className="input resize-none pr-20" />
          <button onClick={lookIdea} disabled={lookBusy} className="chip chip-brand !py-1 absolute bottom-2.5 right-2.5">{lookBusy ? '…' : '✦ Idea'}</button>
        </div>
      </div>

      <button onClick={onNext} className="btn btn-holo w-full !py-3.5 mt-6">Generate {d.name || 'it'}</button>
      <p className="text-[11px] text-center text-[var(--color-ink-faint)] mt-3">
        Upload an image to use it directly, or let AI generate one from your description.
      </p>
    </div>
  )
}

/* ---------- 3 · Forge → look ready ---------- */
function StepForge({ preview, pct, onContinue, onEdit }) {
  const ready = pct >= 100
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center">
      <div className="relative grid place-items-center mb-8">
        <div className="absolute w-64 h-64 rounded-full blur-3xl opacity-60 pointer-events-none" style={{ background: `radial-gradient(circle, ${preview.tone[0]}, transparent 62%)` }} />
        {!ready && <div className="absolute rounded-full spin-slow pointer-events-none" style={{ width: 220, height: 220, border: '1px solid rgba(255,255,255,0.1)' }} />}
        <div className="floaty relative"><CharmAvatar charm={preview} size={ready ? 168 : 150} ring square /></div>
      </div>

      {ready ? (
        <>
          <h1 className="display text-3xl sm:text-4xl mb-1">The look is ready.</h1>
          <div className="flex items-center justify-center gap-1.5 text-[var(--color-ink-soft)] mb-9">
            <span className="font-serif text-xl">{preview.name}</span><Verified size={14} />
            <span className="font-mono text-xs text-[var(--color-ink-faint)]">${preview.ticker}</span>
          </div>
          <div className="w-full max-w-sm space-y-2">
            <button onClick={onContinue} className="btn btn-holo w-full !py-3.5">Continue</button>
            <button onClick={onEdit} className="btn btn-secondary w-full">Edit look</button>
          </div>
        </>
      ) : (
        <>
          <div className="font-mono num text-5xl font-bold holo-text">{pct}%</div>
          <div className="eyebrow mt-3">Generating {preview.name}…</div>
        </>
      )}
    </div>
  )
}

/* ---------- 4 · Soul ---------- */
function StepSoul({ d, preview, set, toggleVibe, togglePersonality, idea, soulBusy, aiTraits, moreTraits, traitBusy, onNext, canLaunch }) {
  const [seed, setSeed] = useState(1)
  // AI-suggested traits when available (GPT-4o-mini); otherwise a rotating subset
  // of the local pool. "more" asks the AI first and falls back to a reshuffle.
  const traits = aiTraits && aiTraits.length ? aiTraits : shuffled(PERSONALITY_POOL, seed).slice(0, 6)
  const onMore = async () => { const ok = await moreTraits(); if (!ok) setSeed((s) => s + 7) }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex flex-col items-center text-center mb-6">
        <CharmAvatar charm={preview} size={72} ring square />
        <div className="flex items-center gap-1.5 mt-3">
          <span className="font-serif text-2xl">{preview.name}</span><Verified size={15} />
          <span className="font-mono text-xs text-[var(--color-ink-faint)]">${preview.ticker}</span>
        </div>
        <h1 className="display text-3xl mt-4">Give {d.name || 'it'} a soul.</h1>
      </div>

      {/* Vibe — up to five */}
      <div className="flex items-center justify-between mb-2">
        <label className="eyebrow">Vibe <span className="text-[var(--color-ink-faint)] normal-case tracking-normal">· up to 5</span></label>
      </div>
      <div className="flex flex-wrap gap-2 mb-6">
        {VIBES.map((v) => {
          const on = d.vibe.includes(v)
          const full = d.vibe.length >= 5
          return (
            <button key={v} onClick={() => toggleVibe(v)} disabled={!on && full}
              className={`chip ${on ? 'chip-brand' : 'hover:bg-[var(--color-line)]'} ${!on && full ? 'opacity-40' : ''}`}>{v}</button>
          )
        })}
      </div>

      {/* Personality — up to three trait cards */}
      <div className="flex items-center justify-between mb-2">
        <label className="eyebrow">Personality <span className="text-[var(--color-ink-faint)] normal-case tracking-normal">· up to 3</span></label>
        <button onClick={onMore} disabled={traitBusy} className="chip chip-brand !py-1">{traitBusy ? '…' : '✦ more'}</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
        {traits.map((p) => {
          const on = d.personality.includes(p)
          const full = d.personality.length >= 3
          return (
            <button key={p} onClick={() => togglePersonality(p)} disabled={!on && full}
              className={`text-left text-sm leading-snug p-3 rounded-2xl border transition ${
                on ? 'chip-brand border-transparent' : `panel-soft border-[var(--color-line)] ${full ? 'opacity-45' : 'hover:border-[var(--color-line-2)]'}`
              }`}>{p}</button>
          )
        })}
      </div>

      {/* Extra soul detail */}
      <div className="flex items-center justify-between mb-1.5">
        <label className="eyebrow">Anything else <span className="text-[var(--color-ink-faint)] normal-case tracking-normal">· optional</span></label>
        <button onClick={idea} disabled={soulBusy} className="chip chip-brand !py-1">{soulBusy ? '…' : '✦ Idea'}</button>
      </div>
      <textarea value={d.lore} onChange={(e) => set('lore', e.target.value.slice(0, 200))} rows={3} placeholder={`Add any extra traits, behaviours or details that define ${d.name || 'it'}.`} className="input resize-none mb-5" />

      <label className="eyebrow block mb-1.5">Your first buy (ETH) <span className="text-[var(--color-ink-faint)] normal-case tracking-normal">· optional</span></label>
      <input value={d.firstBuy} onChange={(e) => set('firstBuy', e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0" inputMode="decimal" className="input mb-6" />

      <button onClick={onNext} disabled={!canLaunch} className="btn btn-holo w-full !py-3.5">Continue</button>
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
          <div className="flex justify-center mb-3"><CharmAvatar charm={preview} size={92} ring square /></div>
          <div className="flex items-center justify-center gap-1.5">
            <span className="font-serif text-3xl">{preview.name}</span><Verified size={16} />
          </div>
          <div className="flex flex-wrap justify-center gap-1.5 mt-3">
            {d.vibe.slice(0, 5).map((v) => <span key={v} className="chip chip-brand">{v}</span>)}
            {d.personality.slice(0, 3).map((p) => <span key={p} className="chip max-w-[150px] truncate">{p}</span>)}
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

      {metaError && (
        <div className="chip chip-down w-full mb-4 flex items-center justify-between gap-3">
          <span>Could not read the pons factory. {friendly(metaError)}</span>
          <button onClick={() => { setMetaError(null); setRetryKey((k) => k + 1) }} className="underline shrink-0 font-medium">Try again</button>
        </div>
      )}
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
          <div className="floaty relative"><CharmAvatar charm={{ ...charm, online: false }} size={128} ring square /></div>
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
