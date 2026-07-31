import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { tokenToAgent, replyFor } from './agents'
import { SEED_TOKENS } from '../data/seed'

// Bundled placeholders shown the instant the app opens on a cold first visit,
// replaced by the live feed within a second or two.
const SEED_AGENTS = SEED_TOKENS.map((t) => tokenToAgent(t, null))

/**
 * The store blends the real X session with the real pons feed and local chat:
 *   • X session (from /api/auth/me + /api/wallet),
 *   • the pons launch feed as agents (from /api/launches) — real tokens only,
 *     no demo cast,
 *   • chat transcripts (local, per token, in localStorage).
 */

const NETWORK = 'robinhood'
const CHAT_KEY = 'eska.chats.v1'
const FEED_KEY = 'eska.feed.v1'
const THEME_KEY = 'eska.theme'
const PROFILE_KEY = 'eska.profile.v1'
const REF_KEY = 'eska.ref.v1'
const StoreCtx = createContext(null)

function loadChats() {
  try { return JSON.parse(localStorage.getItem(CHAT_KEY)) || {} } catch { return {} }
}

// Local profile edits (display name + photo) layered over the X identity. The
// handle always stays whatever X says; only the name and avatar can be changed.
function loadProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {} } catch { return {} }
}

// The last feed we successfully loaded. Painting it instantly on the next visit
// turns the cold-load blank grid into a warm one that refreshes in the
// background, so the front page never sits empty while the RPC works.
function loadFeed() {
  try {
    const j = JSON.parse(localStorage.getItem(FEED_KEY))
    return j && Array.isArray(j.agents) && j.agents.length ? j : null
  } catch { return null }
}

export function StoreProvider({ children }) {
  const [wallet, setWallet] = useState(null)

  const initFeed = typeof window === 'undefined' ? null : loadFeed()
  // Cached feed if we have one, else the bundled seed — so the grid is never blank.
  const [agents, setAgents] = useState(initFeed?.agents ?? SEED_AGENTS)
  const [ethUsd, setEthUsd] = useState(initFeed?.ethUsd ?? null)
  const [explorer, setExplorer] = useState(initFeed?.explorer ?? null)
  // With a cached feed we show it immediately and refresh quietly — no skeletons.
  const [agentsLoading, setAgentsLoading] = useState(!initFeed)

  const [chats, setChats] = useState(() => (typeof window === 'undefined' ? {} : loadChats()))

  // Appearance: 'dark' | 'light' | 'auto'. Applied as data-theme on <html> so the
  // CSS light/dark variables switch; 'auto' follows the OS and updates live.
  const [theme, setThemeState] = useState(() => (typeof window === 'undefined' ? 'dark' : localStorage.getItem(THEME_KEY) || 'dark'))
  const setTheme = useCallback((mode) => {
    setThemeState(mode)
    try { localStorage.setItem(THEME_KEY, mode) } catch {}
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const apply = () => {
      const resolved = theme === 'auto' ? (mq.matches ? 'light' : 'dark') : theme
      document.documentElement.setAttribute('data-theme', resolved)
    }
    apply()
    if (theme === 'auto') {
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
  }, [theme])

  // Local profile overrides (display name + avatar). Cleared keys fall back to X.
  const [profile, setProfile] = useState(() => (typeof window === 'undefined' ? {} : loadProfile()))
  const updateProfile = useCallback((patch) => {
    setProfile((p) => {
      const next = { ...p, ...patch }
      for (const k of Object.keys(next)) if (next[k] == null || next[k] === '') delete next[k]
      try { localStorage.setItem(PROFILE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  useEffect(() => {
    try { localStorage.setItem(CHAT_KEY, JSON.stringify(chats)) } catch {}
  }, [chats])

  // Capture a referral code from ?ref= the moment someone lands, and keep it
  // until they sign in — connect() then forwards it so the referrer is credited.
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const ref = new URLSearchParams(window.location.search).get('ref')
      if (ref) localStorage.setItem(REF_KEY, ref.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 40))
    } catch {}
  }, [])

  // Real X session.
  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const user = data?.user
        if (!user) { setWallet(null); return }
        // Show the signed-in identity immediately — don't make it wait behind the
        // (slower) balance read. The address and ETH balance fill in a moment
        // later without blocking the avatar/handle from appearing.
        setWallet({ id: user.id, handle: '@' + user.username, name: user.name, avatar: user.avatar || null, address: '', ethBalance: null, kind: 'x' })
        fetch('/api/wallet')
          .then((r) => (r.ok ? r.json() : null))
          .then((w) => {
            if (cancelled || !w) return
            setWallet((prev) => prev && prev.id === user.id ? {
              ...prev,
              address: w.address || prev.address,
              ethBalance: w?.balance?.formatted != null ? Number(w.balance.formatted) : prev.ethBalance,
            } : prev)
          })
          .catch(() => {})
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Real pons feed → agents. The discovery feed (/api/launches) plus the
  // launched-here registry (/api/registry), unioned so a coin launched on ESKA
  // always shows the moment it's recorded — even if the discovery feed missed it.
  const loadAgents = useCallback((fresh = false) => {
    setAgentsLoading(true)
    Promise.all([
      fetch(`/api/launches?network=${NETWORK}&limit=20${fresh === true ? '&fresh=1' : ''}`).then((r) => r.json()).catch(() => null),
      fetch(`/api/registry?network=${NETWORK}`).then((r) => r.json()).catch(() => null),
    ])
      .then(([feed, reg]) => {
        const rate = feed?.ethUsd ?? reg?.ethUsd ?? null
        if (feed && !feed.error) {
          setEthUsd(rate)
          setExplorer(feed.explorer ?? null)
        }
        const seen = new Set()
        const agentsOut = []
        // Registry (launched-here) first — most reliable for our own coins —
        // then the discovery feed, de-duplicated by token.
        for (const t of [...(reg?.launches || []), ...(feed?.launches || [])]) {
          const key = (t.token || t.id || '').toLowerCase()
          if (!key || seen.has(key)) continue
          seen.add(key)
          agentsOut.push(tokenToAgent(t, rate))
        }
        // Rank by market cap so the biggest coins lead (launched-here with no cap
        // yet still appears, just lower down).
        agentsOut.sort((a, b) => (b.mcap || 0) - (a.mcap || 0))
        if (agentsOut.length) {
          setAgents(agentsOut)
          try { localStorage.setItem(FEED_KEY, JSON.stringify({ agents: agentsOut, ethUsd: rate, explorer: feed?.explorer ?? null, at: Date.now() })) } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setAgentsLoading(false))
  }, [])
  useEffect(() => { loadAgents() }, [loadAgents])

  const prices = useMemo(() => {
    const m = {}; agents.forEach((a) => (m[a.id] = a.priceUsd ?? a.price)); return m
  }, [agents])
  const agentsById = useMemo(() => {
    const m = {}; for (const a of agents) m[a.id] = a; return m
  }, [agents])
  const getAgent = useCallback((id) => agentsById[id] || null, [agentsById])

  // The identity the app shows: X data with the local name/photo edits on top.
  // `baseName`/`baseAvatar` keep the untouched X values so Edit profile can show
  // what X provides and offer a reset.
  const displayWallet = useMemo(() => {
    if (!wallet) return null
    return {
      ...wallet,
      name: profile.displayName || wallet.name,
      avatar: profile.avatar || wallet.avatar,
      baseName: wallet.name,
      baseAvatar: wallet.avatar,
    }
  }, [wallet, profile])

  function connect() {
    let ref = ''
    try { ref = localStorage.getItem(REF_KEY) || '' } catch {}
    window.location.href = '/api/auth/x/login' + (ref ? `?ref=${encodeURIComponent(ref)}` : '')
  }
  async function disconnect() { try { await fetch('/api/auth/logout', { method: 'POST' }) } catch {}; setWallet(null) }

  const sendMessage = useCallback((id, text) => {
    const agent = agentsById[id]
    const now = Date.now()
    setChats((c) => ({ ...c, [id]: [...(c[id] ?? []), { role: 'user', text, ts: now }] }))
    if (!agent) return
    const reply = replyFor(agent, text)
    setTimeout(() => {
      setChats((c) => ({ ...c, [id]: [...(c[id] ?? []), { role: 'charm', text: reply, ts: Date.now() }] }))
    }, 500 + Math.random() * 600)
  }, [agentsById])

  const value = {
    wallet: displayWallet, connect, disconnect,
    profile, updateProfile,
    theme, setTheme,
    agents, agentsLoading, loadAgents, ethUsd, explorer,
    prices, getAgent,
    chats, sendMessage,
  }
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore() {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore must be inside StoreProvider')
  return ctx
}
