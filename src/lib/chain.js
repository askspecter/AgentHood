import { defineChain } from 'viem'

// Robinhood Chain - the network AURN launches and trades on.
//  - Chain ID: 4663 (L2 on Arbitrum Orbit)
//  - Native currency: ETH
// Ported from Launchpad-Base (Pork) so the wallet + Pons engine share one chain.
function env(name, fallback) {
  const v = typeof process !== 'undefined' ? process.env?.[name] : undefined
  return v && v.trim() ? v.trim() : fallback
}

const DEFAULT_CHAIN_ID = 4663
const parsed = Number(env('NEXT_PUBLIC_CHAIN_ID', String(DEFAULT_CHAIN_ID)))
const CHAIN_ID = Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_CHAIN_ID

const RPC_URL = env('NEXT_PUBLIC_RPC_URL', 'https://rpc.mainnet.chain.robinhood.com')
const EXPLORER_URL = env('NEXT_PUBLIC_EXPLORER_URL', 'https://robinhoodchain.blockscout.com')

export const robinhoodChain = defineChain({
  id: CHAIN_ID,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: 'Blockscout', url: EXPLORER_URL } },
})

export const explorerUrl = EXPLORER_URL
export function explorerTx(hash) { return `${explorerUrl}/tx/${hash}` }
export function explorerToken(address) { return `${explorerUrl}/token/${address}` }
