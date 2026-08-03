import { LegalLayout, Sec, UL } from '../components/LegalPage'

/**
 * About / Company — the official description of ESKA. Kept factual (no invented
 * legal claims): what the product is, what it's built on, and the official
 * channels, so anyone verifying the brand can confirm identity from one page.
 */
export default function About() {
  return (
    <LegalLayout
      title="About ESKA"
      updated="August 1, 2026"
      lead="ESKA is a mobile-first app for launching and trading agent-style tokens on Robinhood Chain. Every agent is a real coin: you can chat with it, trade it, and launch your own — from your pocket. ESKA operates at eska.fun."
    >
      <Sec n={1} title="What ESKA is">
        <p>ESKA turns tokens into characters. It is a consumer interface to a decentralized token protocol (“Bankr”) on Robinhood Chain, where every coin is presented as a living “agent” with a face, a voice, and a live on-chain price.</p>
        <p>Through ESKA you can discover coins, chat with them, view live market data, launch your own coin, and swap coins that live in public liquidity pools — with a wallet minted from your X sign-in, so there is no separate wallet app to install.</p>
      </Sec>

      <Sec n={2} title="What we're building">
        <p>Our mission is to make creating and trading a token feel as simple and playful as posting online — while keeping everything real and on-chain. No demo data, no fake markets: the trades, launches, and balances shown are settled by public smart contracts.</p>
        <p>We are actively developing native iOS and Android apps to make launching a token even easier, wherever you are.</p>
      </Sec>

      <Sec n={3} title="How it works">
        <UL items={[
          'Sign in with X. A blockchain wallet is deterministically derived for your account, so you can transact without a browser extension.',
          'Launch a coin in a few taps — name, look, and soul — deployed through Bankr on Robinhood Chain.',
          'Trade any coin. Prices, liquidity, and market caps are read live from the chain.',
          'Own it. Coins you launch or buy are real tokens in your wallet, and creators can claim their fees.',
        ]} />
      </Sec>

      <Sec n={4} title="Official channels">
        <p>To avoid impersonation, these are the only official ESKA channels. Anything else claiming to be ESKA is not us.</p>
        <UL items={[
          'Website: eska.fun',
          'X (Twitter): @eskafun — x.com/eskafun',
          'Contact: contact@eska.fun',
        ]} />
      </Sec>

      <Sec n={5} title="Safety & transparency">
        <p>ESKA is a front-end. We do not operate a bank, broker-dealer, exchange, or money transmitter, and we do not take custody of your funds beyond the wallet mechanics described in our Terms. Crypto assets are volatile and speculative — nothing in the app is financial advice, and you trade at your own risk.</p>
        <p>Read our <a className="text-[var(--color-accent)] hover:underline" href="/terms">Terms of Service</a> and <a className="text-[var(--color-accent)] hover:underline" href="/privacy">Privacy Policy</a> for the full details.</p>
      </Sec>

      <Sec n={6} title="Contact">
        <p>For partnerships, press, verification, or support, reach us at <a className="text-[var(--color-accent)] hover:underline" href="mailto:contact@eska.fun">contact@eska.fun</a> or on X at <a className="text-[var(--color-accent)] hover:underline" href="https://x.com/eskafun" target="_blank" rel="noopener noreferrer">@eskafun</a>.</p>
      </Sec>
    </LegalLayout>
  )
}
