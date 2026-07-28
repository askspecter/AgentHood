import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { tokenToAgent, replyFor } from './agents'
import { CHARMS as DEMO } from '../data/charms'

/**
 * The store blends real sources with a local one, and never shows a broken feed:
 *   • the X session (real, from /api/auth/me + /api/wallet),
 *   • the pons launch feed as agents (real, from /api/launches),
 *   • a built-in cast so Discover is never empty while the chain is slow/quiet,
 *   • chat transcripts (local, per id, in localStorage).
 *
 * Real pons tokens replace the cast automatically the moment the feed returns
 * any. No RPC error is ever surfaced to the visitor.
 */

const NETWORK = 'robinhood'
const CHAT_KEY = 'eska.chats.v1'
const StoreCtx = createContext(null)

function loadChats() {
  try { return JSON.parse(localStorage.getItem(CHAT_KEY)) || {} } catch { return {} }
}

export function StoreProvider({ children }) {
  const [wallet, setWallet] = useState(null)

  const [realAgents, setRealAgents] = useState([])
  const [ethUsd, setEthUsd] = useState(null)
  const [explorer, setExplorer] = useState(null)
  const [agentsLoading, setAgentsLoading] = useState(true)

  const [chats, setChats] = useState(() => (typeof window === 'undefined' ? {} : loadChats()))

  const [demoPrices, setDemoPrices] = useState(() => {
    const m = {}; DEMO.forEach((c) => (m[c.id] = c.price)); return m
  })

  useEffect(() => {
    try { localStorage.setItem(CHAT_KEY, JSON.stringify(chats)) } catch {}
  }, [chats])

  // Real X session.
  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then(async (data) => {
        if (cancelled) return
        const user = data?.user
        if (!user) { setWallet(null); return }
        let address = ''
        try {
          const w = await fetch('/api/wallet').then((r) => (r.ok ? r.json() : null))
          if (w?.address) address = w.address
        } catch {}
        if (!cancelled) setWallet({ id: user.id, handle: '@' + user.username, name: user.name, avatar: user.avatar || null, address, kind: 'x' })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Real pons feed → agents. On failure/empty the demo cast is used (see below),
  // and no RPC error is surfaced.
  const loadAgents = useCallback(() => {
    setAgentsLoading(true)
    fetch(`/api/launches?network=${NETWORK}&limit=20`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) return
        const rate = json.ethUsd ?? null
        setEthUsd(rate)
        setExplorer(json.explorer ?? null)
        setRealAgents((json.launches || []).map((t) => tokenToAgent(t, rate)))
      })
      .catch(() => {})
      .finally(() => setAgentsLoading(false))
  }, [])
  useEffect(() => { loadAgents() }, [loadAgents])

  // Drift the demo prices only while the demo cast is what's on screen.
  useEffect(() => {
    if (realAgents.length) return
    const t = setInterval(() => {
      setDemoPrices((prev) => {
        const next = { ...prev }
        DEMO.forEach((c) => {
          const base = next[c.id] ?? c.price
          next[c.id] = Math.max(0.0001, base + (Math.random() - 0.48) * base * 0.02)
        })
        return next
      })
    }, 2000)
    return () => clearInterval(t)
  }, [realAgents.length])

  const agents = useMemo(() => (realAgents.length ? realAgents : DEMO), [realAgents])
  const prices = useMemo(() => {
    if (realAgents.length) {
      const m = {}; realAgents.forEach((a) => (m[a.id] = a.priceUsd ?? a.price)); return m
    }
    return demoPrices
  }, [realAgents, demoPrices])

  const agentsById = useMemo(() => {
    const m = {}; for (const a of agents) m[a.id] = a; return m
  }, [agents])
  const getAgent = useCallback((id) => agentsById[id] || null, [agentsById])

  function connect() { window.location.href = '/api/auth/x/login' }
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
    wallet, connect, disconnect,
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
