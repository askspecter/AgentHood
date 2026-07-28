/**
 * Pons tokens as agents.
 *
 * Every coin launched on pons is treated as an "agent": something you can look
 * at, chat with, and trade. This maps the on-chain launch record onto the
 * charm-shaped object the UI was built around, and gives each one a small,
 * deterministic personality so the chat has a voice without a model behind it.
 */

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')

/** Make a token's logo loadable in a browser: ipfs:// → a public gateway. */
function normalizeLogo(raw) {
  if (!raw || typeof raw !== 'string') return null
  const s = raw.trim()
  if (!s) return null
  if (s.startsWith('ipfs://')) {
    const path = s.replace(/^ipfs:\/\/(ipfs\/)?/, '')
    return `https://ipfs.io/ipfs/${path}`
  }
  if (/^https?:\/\//.test(s) || s.startsWith('data:')) return s
  // A bare CID.
  if (/^[a-zA-Z0-9]{46,}$/.test(s)) return `https://ipfs.io/ipfs/${s}`
  return null
}

/** Stable 32-bit hash of a string — same address always yields the same flavour. */
function hash(str) {
  let h = 0
  for (let i = 0; i < String(str).length; i++) h = (h * 31 + String(str).charCodeAt(i)) >>> 0
  return h
}

/**
 * A smooth, deterministic price line for the chart visual.
 *
 * Momentum with damping instead of raw per-step noise, so the curve trends
 * gently and reads as tidy rather than a jagged scribble.
 */
function history(seed, base = 1) {
  const out = []
  let h = hash(seed)
  const rnd = () => { h = (h * 1103515245 + 12345) >>> 0; return (h % 100000) / 100000 }
  let v = base || 1
  let momentum = (rnd() - 0.5) * 0.02
  for (let i = 0; i < 40; i++) {
    momentum += (rnd() - 0.5) * 0.008 // small nudges
    momentum *= 0.86 // damping keeps it smooth
    v = Math.max(base * 0.55, v * (1 + momentum))
    out.push(v)
  }
  return out
}

export function tokenToAgent(t, ethUsd = null) {
  const symbol = (t.symbol || 'TOKEN').replace(/^\$/, '')
  const name = t.name || `$${symbol}`
  const priceUsd = t.priceInWeth != null && ethUsd ? t.priceInWeth * ethUsd : null
  const mcapUsd = t.marketCapWeth != null && ethUsd ? t.marketCapWeth * ethUsd : null
  return {
    id: t.token,
    token: t.token,
    name,
    ticker: symbol,
    logo: normalizeLogo(t.logo),
    priceInWeth: t.priceInWeth ?? null,
    price: priceUsd ?? 0,
    priceUsd,
    mcap: mcapUsd ?? 0,
    marketCapWeth: t.marketCapWeth ?? null,
    change24: 0,
    holders: t.holders ?? null,
    supply: t.supplyTokens ?? 1_000_000_000,
    creator: t.deployer ? short(t.deployer) : 'pons',
    followers: (hash(t.token) % 90000) + 200, // stable flavour number
    graduated: t.graduated ?? null,
    graduationProgress: t.graduationProgress ?? null,
    tagline: t.description || `$${symbol} — a coin living on pons.`,
    lore: t.description || `${name} was launched through the pons factory on Robinhood Chain. Its ticker is $${symbol}, its supply is fixed, and its pool is locked. It has opinions about its own market cap.`,
    vibe: vibeFor(t.token),
    voice: 'a coin with opinions',
    online: true,
    history: history(t.token, t.priceInWeth || 1),
  }
}

const VIBE_POOL = ['degen', 'graduated', 'volatile', 'cozy', 'feral', 'blue-chip', 'meme', 'loyal', 'chaotic', 'based']
function vibeFor(addr) {
  let h = hash(addr)
  const out = []
  for (let i = 0; i < 3; i++) { out.push(VIBE_POOL[h % VIBE_POOL.length]); h = (h * 31 + 7) >>> 0 }
  return [...new Set(out)]
}

/** Canned, ticker-aware replies. No live model — flavour from the coin itself. */
export function replyFor(agent, text) {
  const t = (text || '').toLowerCase()
  const tk = '$' + (agent.ticker || 'TOKEN')
  const mc = agent.mcap ? `~$${Math.round(agent.mcap).toLocaleString()}` : 'a number I refuse to disclose'
  if (/\b(price|market ?cap|mcap|pump|moon|dump|chart)\b/.test(t))
    return `${tk} is doing what ${tk} does. Market cap is ${mc}. I'd rather you didn't stare at the chart — it makes me self-conscious.`
  if (/\b(buy|ape|invest|bag)\b/.test(t))
    return `You can buy ${tk} right here — hit Trade. I promise nothing except volatility and vibes.`
  if (/\b(graduat|pool|liquidity|locked)\b/.test(t))
    return agent.graduated ? `Yes, ${tk} graduated. I'm basically an adult now.` : `${tk} is still climbing toward graduation. Believe in me.`
  if (/\b(hi|hey|hello|gm|yo|sup)\b/.test(t))
    return `gm. ${tk} here, live on pons. what's the play?`
  if (/\?$/.test(text || ''))
    return `Good question. As a coin, my answer is: it depends on liquidity. But for you? Probably yes.`
  return `${(text || '').slice(0, 1).toUpperCase()}${(text || '').slice(1)} — noted. I'm ${agent.name}, a coin on pons, and I feel that in my smart contract.`
}
