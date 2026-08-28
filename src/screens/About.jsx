import { LegalLayout, Sec, UL } from '../components/LegalPage'

/**
 * About / Company — the official description of AURN. Kept factual (no invented
 * legal claims): what the product is, what it's built on, and the official
 * channels, so anyone verifying the brand can confirm identity from one page.
 */
export default function About() {
  return (
    <LegalLayout
      title="About AURN"
      updated="August 1, 2026"
      lead="AURN is a mobile-first app for launching and trading agent-style tokens on Robinhood Chain. Every agent is a real coin: you can chat with it, trade it, and launch your own — from your pocket. AURN operates at eska.fun."
    >
      <Sec n={1} title="What AURN is">
        <p>AURN turns tokens into characters. It is a consumer interface to a decentralized token protocol on Robinhood Chain, where every coin is presented as a living “agent” with a face, a voice, and a live on-chain price.</p>
        <p>Through AURN you can discover coins, chat with them, view live market data, launch your own coin, and swap coins that live in public liquidity pools — with your own self-custodial wallet, so your keys and your funds stay entirely in your hands.</p>
      </Sec>

      <Sec n={2} title="What we're building">
        <p>Our mission is to make creating and trading a token feel as simple and playful as posting online — while keeping everything real and on-chain. No demo data, no fake markets: the trades, launches, and balances shown are settled by public smart contracts.</p>
        <p>We are actively developing native iOS and Android apps to make launching a token even easier, wherever you are.</p>
      </Sec>

      <Sec n={3} title="How it works">
        <UL items={[
          'Connect your wallet — MetaMask, Rainbow, or any WalletConnect wallet. Nothing to derive, no keys to hand over; you sign every transaction yourself.',
          'Launch a coin in a few taps — name, look, and soul — deployed through Pons on Robinhood Chain.',
          'Trade any coin. Prices, liquidity, and market caps are read live from the chain.',
          'Own it. Coins you launch or buy are real tokens in your wallet, and creators can claim their fees.',
        ]} />
      </Sec>

      <Sec n={4} title="Official channels">
        <p>To avoid impersonation, these are the only official AURN channels. Anything else claiming to be AURN is not us.</p>
        <UL items={[
          'Website: eska.fun',
          'X (Twitter): @aurnfun — x.com/aurnfun',
          'Contact: contact@aurn.fun',
        ]} />
      </Sec>

      <Sec n={5} title="Safety & transparency">
        <p>AURN is a front-end. We do not operate a bank, broker-dealer, exchange, or money transmitter, and we never take custody of your funds — your self-custodial wallet always holds them. Crypto assets are volatile and speculative — nothing in the app is financial advice, and you trade at your own risk.</p>
        <p>Read our <a className="text-[var(--color-accent)] hover:underline" href="/terms">Terms of Service</a> and <a className="text-[var(--color-accent)] hover:underline" href="/privacy">Privacy Policy</a> for the full details.</p>
      </Sec>

      <Sec n={6} title="Contact">
        <p>For partnerships, press, verification, or support, reach us at <a className="text-[var(--color-accent)] hover:underline" href="mailto:contact@aurn.fun">contact@aurn.fun</a> or on X at <a className="text-[var(--color-accent)] hover:underline" href="https://x.com/aurnfun" target="_blank" rel="noopener noreferrer">@aurnfun</a>.</p>
      </Sec>
    </LegalLayout>
  )
}
