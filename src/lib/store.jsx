import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { tokenToAgent, replyFor } from './agents'

/**
 * The store now blends two real sources with one local one:
 *   • the X session (real, from /api/auth/me + /api/wallet),
 *   • the pons launch feed as "agents" (real, from /api/launches),
 *   • chat transcripts (local, per token, in localStorage).
 *
 * There is no demo economy any more — balances and holdings are on-chain
 * (the Portfolio reads them). Chat is local flavour on top of real coins.
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
  const [agentsError, setAgentsError] = useState(null)

  const [chats, setChats] = useState(() => (typeof window === 'undefined' ? {} : loadChats()))

  // Persist chat transcripts only — everything else is real/server state.
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

  // Real pons feed → agents.
  const loadAgents = useCallback(() => {
    setAgentsLoading(true)
    setAgentsError(null)
    fetch(`/api/launches?network=${NETWORK}&limit=24`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) { setAgentsError(json.hint ? `${json.error} ${json.hint}` : json.error); return }
        const rate = json.ethUsd ?? null
        setEthUsd(rate)
        setExplorer(json.explorer ?? null)
        setAgents((json.launches || []).map((t) => tokenToAgent(t, rate)))
      })
      .catch(() => setAgentsError('Could not reach the launch feed.'))
      .finally(() => setAgentsLoading(false))
  }, [])
  useEffect(() => { loadAgents() }, [loadAgents])

  const agentsById = useMemo(() => {
    const m = {}
    for (const a of agents) m[a.id] = a
    return m
  }, [agents])
  const prices = useMemo(() => {
    const m = {}
    for (const a of agents) m[a.id] = a.priceUsd ?? a.price
    return m
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
    agents, agentsLoading, agentsError, loadAgents, ethUsd, explorer,
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
