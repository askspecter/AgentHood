import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAccount, useBalance, useDisconnect } from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { tokenToAgent, replyFor } from './agents'
import { SEED_TOKENS } from '../data/seed'

// A wallet address shown as identity: 0x1234…abcd
function shortAddr(a) { return a ? a.slice(0, 6) + '…' + a.slice(-4) : '' }

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

// Local profile edits (display name + photo) layered over the wallet identity.
// The handle always stays the connected address; only name and avatar change.
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
  // Non-custodial identity: the connected wallet IS the account (wagmi + RainbowKit).
  const { address, isConnected } = useAccount()
  const { openConnectModal } = useConnectModal()
  const { disconnect: wagmiDisconnect } = useDisconnect()
  const { data: balanceData } = useBalance({ address, query: { enabled: !!address, refetchInterval: 15000 } })

  const initFeed = typeof window === 'undefined' ? null : loadFeed()
  // Cached feed if we have one, else the bundled seed — so the grid is never blank.
  const [agents, setAgents] = useState(initFeed?.agents ?? SEED_AGENTS)
  const [ethUsd, setEthUsd] = useState(initFeed?.ethUsd ?? null)
  const [explorer, setExplorer] = useState(initFeed?.explorer ?? null)
  // With a cached feed we show it immediately and refresh quietly — no skeletons.
  const [agentsLoading, setAgentsLoading] = useState(!initFeed)

  const [chats, setChats] = useState(() => (typeof window === 'undefined' ? {} : loadChats()))
  // Which chat threads are waiting on the agent's reply (for the typing bubble).
  const [chatTyping, setChatTyping] = useState({})

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

  // Capture a referral code from ?ref= the moment someone lands, and keep it in
  // local storage so a later wallet-based referral credit can read it.
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const ref = new URLSearchParams(window.location.search).get('ref')
      if (ref) localStorage.setItem(REF_KEY, ref.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 40))
    } catch {}
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
          // Skip a coin whose real name/symbol couldn't be read this cycle — it
          // would render as the "$TOKEN" placeholder. It comes back the moment its
          // symbol resolves. The official pin is always kept.
          if (!t.official && !t.symbol && !t.name) continue
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
    if (!isConnected || !address) return null
    const short = shortAddr(address)
    const ethBalance = balanceData?.formatted != null ? Number(balanceData.formatted) : null
    return {
      id: address,
      address,
      handle: short,
      name: profile.displayName || short,
      avatar: profile.avatar || null,
      ethBalance,
      kind: 'wallet',
      baseName: short,
      baseAvatar: null,
    }
  }, [isConnected, address, balanceData, profile])

  // Open the RainbowKit modal (MetaMask / Injected / Rainbow / WalletConnect).
  const connect = useCallback(() => { openConnectModal?.() }, [openConnectModal])
  const disconnect = useCallback(() => { try { wagmiDisconnect() } catch {} }, [wagmiDisconnect])

  const sendMessage = useCallback((id, text) => {
    const agent = agentsById[id]
    const now = Date.now()
    // The turns the model should see — before this new user line is added.
    const priorHistory = chats[id] ?? []
    setChats((c) => ({ ...c, [id]: [...(c[id] ?? []), { role: 'user', text, ts: now }] }))
    if (!agent) return

    // A stable timestamp identifies this reply so streamed tokens land in the
    // right bubble even as new messages arrive.
    const replyTs = now + 1
    const clearTyping = () => setChatTyping((t) => { const n = { ...t }; delete n[id]; return n })
    const updateReply = (patch) => setChats((c) => {
      const list = c[id] ?? []
      const i = list.findIndex((m) => m.ts === replyTs)
      if (i === -1) return c
      const next = list.slice(); next[i] = { ...next[i], ...patch }; return { ...c, [id]: next }
    })
    // Put the built-in local flavour in the reply bubble (fallback path).
    const useLocal = () => setChats((c) => {
      const list = c[id] ?? []
      const i = list.findIndex((m) => m.ts === replyTs)
      const msg = { role: 'charm', text: replyFor(agent, text), ts: replyTs, streaming: false }
      if (i === -1) return { ...c, [id]: [...list, msg] }
      const next = list.slice(); next[i] = msg; return { ...c, [id]: next }
    })

    // Talk to the live agent — a real model that speaks as the coin and knows its
    // numbers, streamed so it types out live. Fall back to the built-in local
    // flavour whenever AI isn't configured or the request fails, so chat always
    // answers.
    setChatTyping((t) => ({ ...t, [id]: true }))
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 22000)
    const facts = {
      ticker: agent.ticker, name: agent.name, mcap: agent.mcap, priceUsd: agent.priceUsd,
      change24: agent.change24, holders: agent.holders, graduated: agent.graduated,
      graduationProgress: agent.graduationProgress, creator: agent.creator, official: agent.official, vibe: agent.vibe,
    }
    ;(async () => {
      let res
      try {
        res = await fetch('/api/agent/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
          body: JSON.stringify({ agent: facts, history: priorHistory.slice(-8), message: text }),
        })
      } catch { useLocal(); return }
      if (!res.ok || !res.body) { useLocal(); return }

      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let acc = '', started = false
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          acc += dec.decode(value, { stream: true })
          if (!started && acc) {
            started = true
            clearTyping()
            setChats((c) => ({ ...c, [id]: [...(c[id] ?? []), { role: 'charm', text: acc, ts: replyTs, streaming: true }] }))
          } else if (started) {
            updateReply({ text: acc })
          }
        }
      } catch { /* keep whatever streamed so far */ }
      if (!acc.trim()) useLocal()
      else updateReply({ streaming: false })
    })().finally(() => { clearTimeout(timer); clearTyping() })
  }, [agentsById, chats])

  const value = {
    wallet: displayWallet, connect, disconnect,
    profile, updateProfile,
    theme, setTheme,
    agents, agentsLoading, loadAgents, ethUsd, explorer,
    prices, getAgent,
    chats, sendMessage, chatTyping,
  }
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore() {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore must be inside StoreProvider')
  return ctx
}
