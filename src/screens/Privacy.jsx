import { LegalLayout, Sec, UL } from '../components/LegalPage'

export default function Privacy() {
  return (
    <LegalLayout
      title="Privacy Policy"
      updated="July 29, 2026"
      lead="This Privacy Policy explains what information ESKA collects when you use eska.fun, how we use it, and the choices you have. ESKA is built to lean on public blockchain data and to keep as little about you as possible on our servers. By using the Service you agree to this Policy."
    >
      <Sec n={1} title="A quick summary">
        <UL items={[
          'We sign you in with X and read only your basic public profile (id, handle, name, and avatar).',
          'Your wallet address is derived from your X account. Its balances and activity are public on the blockchain — that is inherent to how blockchains work, not something we publish.',
          'Your chats with a coin, your theme choice, and any name/photo you set in Edit profile are stored on your own device, not on our servers.',
          'We do not sell your personal information.',
        ]} />
      </Sec>

      <Sec n={2} title="Information we collect">
        <p><strong className="text-[var(--color-ink)]">From X sign-in.</strong> When you connect X, we receive your X user id, username (handle), display name, and profile image. We use your user id to derive and recognize your wallet. We do not receive your X password, and we do not post to X on your behalf.</p>
        <p><strong className="text-[var(--color-ink)]">Wallet and on-chain data.</strong> We compute your wallet address and read public blockchain data to show your balance, holdings, and the coins in the feed. Everything on a public blockchain is, by design, visible to anyone.</p>
        <p><strong className="text-[var(--color-ink)]">Technical data.</strong> Like most websites, our hosting provider may automatically log basic technical information such as IP address, browser type, and timestamps to keep the Service running and secure.</p>
        <p><strong className="text-[var(--color-ink)]">Stored on your device.</strong> Your chat transcripts, appearance preference, referral view, and profile edits (display name and photo) are saved in your browser’s local storage and never leave your device unless you clear or move them.</p>
      </Sec>

      <Sec n={3} title="What we do not collect">
        <UL items={[
          'We do not collect your X password or private messages.',
          'We do not store your wallet’s private key in a database — it is derived on demand from a server secret and your X id, and used only to sign a transaction you asked for.',
          'We do not ask for your legal name, address, or government ID to browse or trade.',
        ]} />
      </Sec>

      <Sec n={4} title="How we use information">
        <UL items={[
          'To sign you in and recognize your account and wallet.',
          'To show your balance, holdings, and the live coin feed.',
          'To execute the swaps, transfers, and launches you initiate.',
          'To operate, secure, debug, and improve the Service.',
          'To respond to your support requests.',
        ]} />
      </Sec>

      <Sec n={5} title="Cookies and sessions">
        <p>We use a single secure, signed session cookie to keep you logged in after you sign in with X. It is an <span className="font-mono text-[13px]">httpOnly</span> cookie, meaning it cannot be read by page scripts, and it holds only what is needed to identify your session. We do not use third-party advertising or tracking cookies.</p>
      </Sec>

      <Sec n={6} title="How information is shared">
        <p>We share information only as needed to run the Service:</p>
        <UL items={[
          'X, for authentication.',
          'Blockchain RPC providers and block explorers, to read public chain data and broadcast the transactions you initiate.',
          'Our hosting and infrastructure providers, to serve the site.',
          'Where required by law, or to protect the rights, safety, and security of ESKA, our users, or the public.',
        ]} />
        <p>We do not sell or rent your personal information to anyone.</p>
      </Sec>

      <Sec n={7} title="Blockchain data is permanent and public">
        <p>Transactions you make are recorded on a public blockchain that we do not control and cannot change or erase. Your wallet address and its full transaction history are visible to anyone, and may be retained by third parties indefinitely. Please keep this in mind before transacting.</p>
      </Sec>

      <Sec n={8} title="Data retention">
        <p>We keep the limited account data described above for as long as your account is active and as needed to operate the Service. Data stored on your device stays until you clear your browser storage. On-chain data is outside our control and is permanent.</p>
      </Sec>

      <Sec n={9} title="Security">
        <p>We use reasonable technical measures to protect the Service, including signed session cookies and deriving keys on demand rather than storing them. No system is perfectly secure, however, and you are responsible for protecting access to your X account, which controls your wallet.</p>
      </Sec>

      <Sec n={10} title="Your choices and rights">
        <UL items={[
          'You can sign out at any time from Settings, which ends your session.',
          'You can clear your on-device data (chats, preferences, profile edits) by clearing your browser storage.',
          'You can disconnect ESKA from your X account in your X app settings.',
          'Depending on where you live, you may have rights to access, correct, or delete the limited personal data we hold — contact us to make a request.',
        ]} />
      </Sec>

      <Sec n={11} title="Children">
        <p>The Service is not directed to anyone under 18, and we do not knowingly collect information from children. If you believe a child has used the Service, contact us and we will take appropriate steps.</p>
      </Sec>

      <Sec n={12} title="International users">
        <p>ESKA may be operated from, and use providers in, countries other than yours. By using the Service you understand your information may be processed in those countries, which may have different data-protection rules than your own.</p>
      </Sec>

      <Sec n={13} title="Changes to this Policy">
        <p>We may update this Policy from time to time. When we do, we will change the “last updated” date above. Material changes will be made clear within the Service. Your continued use after an update means you accept it.</p>
      </Sec>

      <Sec n={14} title="Contact">
        <p>For any privacy question or request, email <a className="text-[var(--color-accent)] hover:underline" href="mailto:contact@eska.fun">contact@eska.fun</a> or reach us on X at <a className="text-[var(--color-accent)] hover:underline" href="https://x.com/eskafun" target="_blank" rel="noopener noreferrer">@eskafun</a>.</p>
      </Sec>
    </LegalLayout>
  )
}
