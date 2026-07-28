import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { tokenToAgent, replyFor } from './agents'

/**
 * The store blends real sources with one local one:
 *   • the X session (real, from /api/auth/me + /api/wallet),
 *   • the pons launch feed as agents (real, from /api/launches),
 *   • chat transcripts (local, per token, in localStorage).
 *
 * The feed is real pons tokens only — no demo cast. While it loads, the UI
 * shows its own skeleton; if it is genuinely empty, the empty state invites a
 * launch.
 */

const NETWORK = 'robinhood'
const CHAT_KEY = 'eska.chats.v1'
const StoreCtx = createContext(null)

function loadChats() {
  try { return JSON.parse(localStorage.getItem(CHAT_KEY)) || {} } catch { return {} }
}

export function StoreProvider({ children }) {
  const [wallet, setWallet] = useState(null)

  const [agents, setAgents] = useState([])
  const [ethUsd, setEthUsd] = useState(null)
  const [explorer, setExplorer] = useState(null)
  const [agentsLoading, setAgentsLoading] = useState(true)

  const [chats, setChats] = useState(() => (typeof window === 'undefined' ? {} : loadChats()))

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

  // Real pons feed → agents. No demo fallback and no surfaced RPC error.
  const loadAgents = useCallback(() => {
    setAgentsLoading(true)
    fetch(`/api/launches?network=${NETWORK}&limit=24`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) return
        const rate = json.ethUsd ?? null
        setEthUsd(rate)
        setExplorer(json.explorer ?? null)
        setAgents((json.launches || []).map((t) => tokenToAgent(t, rate)))
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
