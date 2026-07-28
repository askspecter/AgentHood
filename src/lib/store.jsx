import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CHARMS as SEED } from '../data/charms'

const KEY = 'eska.app.v1'
const StoreCtx = createContext(null)

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

export function StoreProvider({ children }) {
  const saved = load()

  const [wallet, setWallet] = useState(saved?.wallet ?? null) // {address, handle}
  const [cash, setCash] = useState(saved?.cash ?? 0) // demo USDC balance (start empty, like onboarding)
  const [holdings, setHoldings] = useState(saved?.holdings ?? {}) // {charmId: {units, cost}}
  const [activity, setActivity] = useState(saved?.activity ?? [])
  const [chats, setChats] = useState(saved?.chats ?? {}) // {charmId: [{role, text, ts}]}
  const [custom, setCustom] = useState(saved?.custom ?? []) // user-launched charms
  const [watch, setWatch] = useState(saved?.watch ?? [])

  // live-moving prices, kept in a ref-backed state so charts feel alive
  const [prices, setPrices] = useState(() => {
    const map = {}
    ;[...SEED, ...(saved?.custom ?? [])].forEach((c) => (map[c.id] = c.price))
    return map
  })
  const pricesRef = useRef(prices)
  pricesRef.current = prices

  // persist
  useEffect(() => {
    const data = { wallet, cash, holdings, activity, chats, custom, watch }
    try { localStorage.setItem(KEY, JSON.stringify(data)) } catch {}
  }, [wallet, cash, holdings, activity, chats, custom, watch])

  const charms = useMemo(() => [...custom, ...SEED], [custom])

  // simulate a living market: nudge every price a little each tick
  useEffect(() => {
    const t = setInterval(() => {
      setPrices((prev) => {
        const next = { ...prev }
        charms.forEach((c) => {
          const base = next[c.id] ?? c.price
          const drift = (Math.random() - 0.48) * base * 0.02
          next[c.id] = Math.max(0.0001, base + drift)
        })
        return next
      })
    }, 2000)
    return () => clearInterval(t)
  }, [charms])

  function connect() {
    // demo sign-in with X only — no real OAuth happens
    const address = '0x' + Math.random().toString(16).slice(2, 10) + '…' + Math.random().toString(16).slice(2, 6)
    setWallet({ address, handle: '@you', kind: 'x' })
  }
  function disconnect() { setWallet(null) }

  function addCash(amount = 1000) {
    setCash((c) => +(c + amount).toFixed(2))
    logActivity({ type: 'deposit', usd: amount })
  }

  function priceOf(id) { return pricesRef.current[id] ?? getCharm(id)?.price ?? 0 }
  function getCharm(id) { return charms.find((c) => c.id === id) }

  function logActivity(entry) {
    setActivity((a) => [{ ...entry, ts: Date.now() }, ...a].slice(0, 60))
  }

  function buy(id, usdAmount) {
    const price = prices[id] ?? getCharm(id).price
    if (usdAmount <= 0 || usdAmount > cash) return { ok: false, error: 'Not enough balance' }
    const units = usdAmount / price
    setCash((c) => +(c - usdAmount).toFixed(2))
    setHoldings((h) => {
      const cur = h[id] ?? { units: 0, cost: 0 }
      return { ...h, [id]: { units: cur.units + units, cost: cur.cost + usdAmount } }
    })
    logActivity({ type: 'buy', id, usd: usdAmount, units, price })
    return { ok: true, units }
  }

  function sell(id, unitsToSell) {
    const cur = holdings[id]
    if (!cur || unitsToSell <= 0 || unitsToSell > cur.units + 1e-9) return { ok: false, error: 'Not enough units' }
    const price = prices[id] ?? getCharm(id).price
    const proceeds = unitsToSell * price
    setCash((c) => +(c + proceeds).toFixed(2))
    setHoldings((h) => {
      const remaining = cur.units - unitsToSell
      const costLeft = cur.cost * (remaining / cur.units)
      const nh = { ...h }
      if (remaining < 1e-9) delete nh[id]
      else nh[id] = { units: remaining, cost: costLeft }
      return nh
    })
    logActivity({ type: 'sell', id, usd: proceeds, units: unitsToSell, price })
    return { ok: true, proceeds }
  }

  function sendMessage(id, text) {
    const charm = getCharm(id)
    const now = Date.now()
    setChats((c) => ({ ...c, [id]: [...(c[id] ?? []), { role: 'user', text, ts: now }] }))
    const reply = replyFor(charm, text)
    setTimeout(() => {
      setChats((c) => ({ ...c, [id]: [...(c[id] ?? []), { role: 'charm', text: reply, ts: Date.now() }] }))
    }, 500 + Math.random() * 700)
  }

  function launchCharm(draft) {
    const id = draft.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Math.random().toString(36).slice(2, 5)
    const charm = {
      id,
      name: draft.name,
      ticker: draft.ticker.toUpperCase(),
      hue: draft.hue ?? Math.floor(Math.random() * 360),
      tagline: draft.tagline,
      lore: draft.lore,
      creator: wallet?.handle ?? 'you',
      price: 0.0001,
      holders: 1,
      supply: 1_000_000_000,
      mcap: 100_000,
      change24: 0,
      followers: 0,
      vibe: draft.vibe ?? [],
      online: true,
      voice: draft.voice || draft.tagline,
      history: Array.from({ length: 48 }, (_, i) => 0.00008 + i * 0.0000005),
      isMine: true,
    }
    setCustom((cs) => [charm, ...cs])
    setPrices((p) => ({ ...p, [id]: charm.price }))
    logActivity({ type: 'launch', id })
    return charm
  }

  function toggleWatch(id) {
    setWatch((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]))
  }

  const portfolioValue = useMemo(() => {
    let v = 0
    for (const [id, h] of Object.entries(holdings)) v += h.units * (prices[id] ?? getCharm(id)?.price ?? 0)
    return v
  }, [holdings, prices]) // eslint-disable-line

  const value = {
    wallet, connect, disconnect, addCash,
    cash, holdings, activity, chats, custom, watch,
    charms, prices, priceOf, getCharm,
    buy, sell, sendMessage, launchCharm, toggleWatch,
    portfolioValue,
  }
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore() {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore must be inside StoreProvider')
  return ctx
}

// canned, personality-flavored responses — original templates
function replyFor(charm, text) {
  const t = text.toLowerCase()
  const name = charm?.name ?? 'Charm'
  const openers = {
    nimbus: ['Barometer says: ', 'Forecast incoming — ', 'Skies are clearing. '],
    kettle: ['okay so — ', "you didn't hear it from me but ", '*whistles* '],
    atlas: ['From orbit it all looked so small. ', 'Oh, this? This is beautiful. ', 'Let the record show: '],
    ledger: ['Noted. ', 'Reconciling… ', 'For the record: '],
    marrow: ['*tail wags* ', 'GRRR— oh, it\'s you. ', 'I would guard this with my life. '],
    pixel: ['LEVEL UP. ', 'press start. ', '*8-bit chime* '],
    saffron: ['Mm. ', 'How very you. ', 'I grew a flower for that. '],
    volt: ['LETS GOOO. ', 'OKAY LISTEN. ', 'ZERO NOTES. '],
  }
  const op = (openers[charm?.id] ?? [''])
  const pick = op[Math.floor(Math.random() * op.length)]
  if (/\b(price|coin|token|buy|moon|pump)\b/.test(t))
    return pick + `My coin does what it wants — I just live in it. But I'd rather talk about you than ${charm.ticker}.`
  if (/\b(hi|hey|hello|gm|yo)\b/.test(t))
    return pick + `hey. ${name} here. what's the situation?`
  if (/\?$/.test(text))
    return pick + `Honestly? ${text.replace(/\?+$/, '')} — depends who's asking. Tell me more.`
  return pick + `${text.slice(0, 1).toUpperCase() + text.slice(1)}... yeah. I feel that. (I'm ${name}, remember — ${charm?.voice}.)`
}
