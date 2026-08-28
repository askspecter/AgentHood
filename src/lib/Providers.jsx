import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { WagmiProvider, http, useReconnect } from 'wagmi'
import { RainbowKitProvider, getDefaultConfig, darkTheme, lightTheme } from '@rainbow-me/rainbowkit'
import { injectedWallet, metaMaskWallet, rainbowWallet, walletConnectWallet } from '@rainbow-me/rainbowkit/wallets'
import { robinhoodChain } from './chain'

// Non-custodial wallet connect — wagmi v2 + RainbowKit, the working setup ported
// from Launchpad-Base (Pork). The modal offers MetaMask / Browser Wallet /
// Rainbow / WalletConnect on Robinhood Chain. The Coinbase/base SDK subtree that
// the connector barrel eagerly imports is stubbed in next.config.mjs.
const wagmiConfig = getDefaultConfig({
  appName: 'AURN',
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || 'eska_missing_wc_project_id',
  chains: [robinhoodChain],
  transports: { [robinhoodChain.id]: http() },
  ssr: false,
  wallets: [
    { groupName: 'Popular', wallets: [metaMaskWallet, injectedWallet, rainbowWallet, walletConnectWallet] },
  ],
})

// AURN is dark-first; the connect modal follows via data-theme on <html>.
const rkDark = darkTheme({ accentColor: '#bcd0f4', accentColorForeground: '#0a0c15', borderRadius: 'large', overlayBlur: 'small', fontStack: 'system' })
const rkLight = lightTheme({ accentColor: '#4f66b4', accentColorForeground: '#ffffff', borderRadius: 'large', overlayBlur: 'small', fontStack: 'system' })

export default function Providers({ children }) {
  const [queryClient] = useState(() => new QueryClient())
  // Follow the app's own theme toggle (data-theme on <html>) so the modal matches.
  const [dark, setDark] = useState(true)
  useEffect(() => {
    const read = () => setDark(document.documentElement.getAttribute('data-theme') !== 'light')
    read()
    const obs = new MutationObserver(read)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  // reconnectOnMount={false} avoids the RainbowKit "e.uid" crash when a stored
  // wallet is on an unsupported chain; we reconnect post-mount instead.
  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={dark ? rkDark : rkLight} modalSize="compact">
          <AutoReconnect />
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

function AutoReconnect() {
  const { reconnect } = useReconnect()
  useEffect(() => { try { reconnect() } catch {} }, [reconnect])
  return null
}
