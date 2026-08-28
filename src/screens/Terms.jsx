import { LegalLayout, Sec, UL } from '../components/LegalPage'

export default function Terms() {
  return (
    <LegalLayout
      title="Terms of Service"
      updated="August 28, 2026"
      lead="Welcome to AURN. These Terms of Service (“Terms”) govern your access to and use of the AURN website, app, and related services (together, the “Service”), operated at aurn.fun. By signing in, connecting a wallet, or otherwise using the Service, you agree to these Terms. If you do not agree, do not use the Service."
    >
      <Sec n={1} title="What AURN is">
        <p>AURN is an interface to a decentralized token protocol on Robinhood Chain. Through AURN you can discover coins, view live on-chain market data, launch a coin, and swap coins that live in public liquidity pools. AURN is a front-end: the trades, launches, and balances you see are settled by smart contracts on a public blockchain, not by us.</p>
        <p>We do not operate a bank, broker-dealer, exchange, or money transmitter. We never take custody of your funds — your self-custodial wallet always holds them — we do not match orders, and we do not guarantee liquidity, price, or the availability of any market.</p>
      </Sec>

      <Sec n={2} title="Eligibility">
        <p>To use the Service you must be at least 18 years old and legally able to enter into these Terms. You may not use the Service if you are located in, or are a resident or citizen of, any jurisdiction where accessing crypto-asset services is prohibited, or if you are subject to sanctions under applicable law.</p>
        <p>You are responsible for ensuring that your use of the Service is legal where you live. Access from a particular country does not mean the Service is appropriate or available there.</p>
      </Sec>

      <Sec n={3} title="Connecting your wallet">
        <p>You connect your own self-custodial wallet — such as MetaMask, Rainbow, or any WalletConnect-compatible wallet. We never create, hold, or have access to your wallet or its private keys. Every transaction is signed inside your wallet, by you; we only prepare the transaction for you to review and approve.</p>
        <UL items={[
          'You are solely responsible for safeguarding your wallet, its seed phrase, and its private keys. We cannot recover them, reset them, or move your funds if you lose access.',
          'You are solely responsible for all activity that occurs through your connected wallet.',
          'Transactions on a blockchain are irreversible. Once a swap, transfer, or launch is confirmed on-chain, it cannot be undone by us or anyone else.',
        ]} />
      </Sec>

      <Sec n={4} title="No financial advice">
        <p>Nothing on the Service is investment, financial, legal, or tax advice. Market data, charts, rankings, token descriptions, and any “agent” personality shown for a coin are for information and entertainment only. We do not recommend any coin and do not endorse the coins listed.</p>
        <p>You alone decide whether to buy, sell, hold, or launch any coin, and you do so at your own risk. Do your own research.</p>
      </Sec>

      <Sec n={5} title="Crypto risk">
        <p>Crypto assets are highly volatile and speculative. You should be prepared to lose the entire value of anything you buy or launch. In particular:</p>
        <UL items={[
          'Coins launched through a permissionless protocol can be created by anyone, may have no utility, and may go to zero.',
          'Prices can move sharply, liquidity can disappear, and you may be unable to sell at any price.',
          'Smart contracts can contain bugs or be exploited, and blockchains can experience congestion, reorganizations, or downtime.',
          'Gas fees, slippage, and failed transactions can cost you money even when a trade does not complete.',
        ]} />
      </Sec>

      <Sec n={6} title="Acceptable use">
        <p>You agree not to use the Service to:</p>
        <UL items={[
          'Break any law, or facilitate money laundering, sanctions evasion, fraud, or market manipulation.',
          'Launch or promote coins that infringe others’ rights, impersonate a person or brand, or are designed to deceive.',
          'Interfere with, overload, scrape at scale, or attempt to gain unauthorized access to the Service or its infrastructure.',
          'Introduce malware, or reverse engineer the Service except to the limited extent the law permits.',
        ]} />
      </Sec>

      <Sec n={7} title="Coins you launch">
        <p>If you launch a coin, you are its creator and are solely responsible for it, including its name, symbol, image, description, and any promises you make about it. You represent that you have the rights to everything you upload and that it does not violate these Terms or the law. We may remove a coin from the AURN interface at any time, but we cannot alter or remove anything already recorded on-chain.</p>
      </Sec>

      <Sec n={8} title="Locking tokens">
        <p>AURN offers an on-chain token lock. When you lock tokens, you approve and transfer them into the AurnLocker smart contract for a fixed term that you choose. This is non-custodial: only your wallet can withdraw the tokens, and only after the term you set has passed. AURN never holds the tokens or your keys, and cannot release, extend, or seize a lock.</p>
        <UL items={[
          'A lock is enforced by the smart contract on-chain, not by AURN. Once confirmed, it cannot be undone, shortened, or reversed by us or anyone else before the term ends.',
          'The lock registry is public. The tokens you lock, the amount, your wallet address, and the unlock time are visible on-chain to anyone, including through the Locked page without a wallet.',
          'You are responsible for the tokens you lock and for choosing the term. Make sure the token contract behaves as expected before locking, and understand that funds are inaccessible until the term ends.',
        ]} />
      </Sec>

      <Sec n={9} title="Fees">
        <p>The protocol may charge on-chain fees (for example, a small launch fee and pool trading fees). Blockchain network (gas) fees also apply to every transaction and are paid to the network, not to us. Fees are shown or estimated before you confirm where possible, but final amounts are determined on-chain.</p>
      </Sec>

      <Sec n={10} title="Third-party services">
        <p>The Service relies on third parties we do not control, including X for sign-in, blockchain RPC providers, block explorers, and hosting. Their availability and terms are their own. We are not responsible for third-party outages, decisions, or content, including the content of any coin listed through the underlying protocol.</p>
      </Sec>

      <Sec n={11} title="Intellectual property">
        <p>The AURN name, logo, interface, and original content are owned by us or our licensors and are protected by law. We grant you a limited, revocable, non-exclusive, non-transferable license to use the Service for its intended purpose. You may not copy, resell, or create derivative works from the Service without our permission.</p>
      </Sec>

      <Sec n={12} title="Disclaimers">
        <p>The Service is provided “as is” and “as available”, without warranties of any kind, whether express or implied, including merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the Service will be uninterrupted, accurate, secure, or error-free, or that any data shown (including prices and balances) is correct or current.</p>
      </Sec>

      <Sec n={13} title="Limitation of liability">
        <p>To the maximum extent permitted by law, AURN and its operators will not be liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss of profits, funds, tokens, or data, arising out of or related to your use of the Service. Our total liability for any claim will not exceed the greater of the fees you paid us in the three months before the claim or USD $100.</p>
      </Sec>

      <Sec n={14} title="Indemnity">
        <p>You agree to indemnify and hold harmless AURN and its operators from any claims, losses, and expenses (including reasonable legal fees) arising from your use of the Service, your coins, or your breach of these Terms or the law.</p>
      </Sec>

      <Sec n={15} title="Suspension and changes">
        <p>We may modify, suspend, or discontinue any part of the Service at any time, and we may update these Terms. If we make material changes, we will update the “last updated” date above. Your continued use after changes take effect means you accept them. We may also restrict access to accounts that violate these Terms.</p>
      </Sec>

      <Sec n={16} title="Contact">
        <p>Questions about these Terms? Email us at <a className="text-[var(--color-accent)] hover:underline" href="mailto:contact@aurn.fun">contact@aurn.fun</a> or reach us on X at <a className="text-[var(--color-accent)] hover:underline" href="https://x.com/aurnfun" target="_blank" rel="noopener noreferrer">@aurnfun</a>.</p>
      </Sec>
    </LegalLayout>
  )
}
