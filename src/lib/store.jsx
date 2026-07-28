import { createContext, useContext, useEffect, useState } from 'react'

/**
 * The whole client store is now just the real X session.
 *
 * Identity lives in an httpOnly cookie set by /api/auth/x/callback, so on mount
 * we ask the server who is signed in rather than trusting anything the browser
 * could edit. A wallet is derived from the X account server-side; /api/wallet
 * returns its address when WALLET_DERIVATION_SECRET is configured.
 */

const StoreCtx = createContext(null)

export function StoreProvider({ children }) {
  const [wallet, setWallet] = useState(null) // { id, handle, name, avatar, address, kind }
  const [ready, setReady] = useState(false)

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
        if (!cancelled) {
          setWallet({
            id: user.id,
            handle: '@' + user.username,
            name: user.name,
            avatar: user.avatar || null,
            address,
            kind: 'x',
          })
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setReady(true) })
    return () => { cancelled = true }
  }, [])

  function connect() {
    // Hand off to the real OAuth 2.0 (PKCE) flow.
    window.location.href = '/api/auth/x/login'
  }
  async function disconnect() {
    try { await fetch('/api/auth/logout', { method: 'POST' }) } catch {}
    setWallet(null)
  }

  return (
    <StoreCtx.Provider value={{ wallet, ready, connect, disconnect }}>
      {children}
    </StoreCtx.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore must be inside StoreProvider')
  return ctx
}
