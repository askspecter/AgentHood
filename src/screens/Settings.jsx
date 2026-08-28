import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Back, RowIcon, Chevron } from '../components/icons'

export default function Settings() {
  const nav = useNavigate()
  const { disconnect, theme, setTheme } = useStore()

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => nav(-1)} className="grid place-items-center w-10 h-10 rounded-lg border hairline hover:bg-[var(--color-paper-2)]"><Back size={18} /></button>
        <h1 className="font-serif text-3xl">Settings</h1>
      </div>

      <Section title="Account">
        <Row icon="editProfile" label="Edit profile" onClick={() => nav('/settings/profile')} />
        <Row icon="leaderboard" label="Leaderboard" onClick={() => nav('/leaderboard')} />
        <Row icon="appearance" label="Appearance" right={
          <div className="seg shrink-0">
            {['light', 'dark', 'auto'].map((k) => <button key={k} onClick={() => setTheme(k)} className={`capitalize !px-2.5 !text-[13px] ${theme === k ? 'on' : ''}`}>{k}</button>)}
          </div>
        } />
        <Row icon="gift" label="Referral code" onClick={() => nav('/settings/referral')} />
        <Row icon="terminal" label="AI access (MCP)" onClick={() => nav('/settings/ai')} last />
      </Section>

      <Section title="Resources">
        <Row icon="docs" label="About AURN" onClick={() => nav('/about')} />
        <Row icon="tos" label="Terms of service" onClick={() => nav('/terms')} />
        <Row icon="privacy" label="Privacy policy" onClick={() => nav('/privacy')} />
        <Row icon="x" label="Follow us on X" href="https://x.com/aurnfun" external />
        <Row icon="support" label="Support" href="mailto:contact@eska.fun" />
        <Row icon="docs" label="Documentation" href="https://docs.eska.fun" external last />
      </Section>

      <div className="card overflow-hidden mb-4">
        <button onClick={() => { disconnect(); nav('/') }} className="w-full flex items-center gap-3 p-4 hover:bg-[var(--color-paper-2)]">
          <span className="w-9 h-9 grid place-items-center rounded-lg bg-[var(--color-down-soft)]"><RowIcon name="logout" stroke="var(--color-down)" /></span>
          <span className="font-medium text-[var(--color-down)]">Disconnect wallet</span>
        </button>
      </div>

      <div className="text-center text-xs text-[var(--color-ink-faint)]">AURN v0.1.0</div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="mb-7">
      <h2 className="eyebrow mb-3">{title}</h2>
      <div className="card overflow-hidden">{children}</div>
    </div>
  )
}

function Row({ icon, label, right, last, onClick, href, external }) {
  const cls = `w-full flex items-center gap-3 p-4 hover:bg-[var(--color-paper-2)] text-left transition ${last ? '' : 'border-b hairline'}`
  const inner = (
    <>
      <span className="w-9 h-9 grid place-items-center rounded-lg bg-[var(--color-paper-2)] shrink-0"><RowIcon name={icon} size={18} /></span>
      <span className="font-medium flex-1 min-w-0 truncate">{label}</span>
      {right ?? <Chevron />}
    </>
  )
  if (href) {
    return (
      <a href={href} className={cls} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{inner}</a>
    )
  }
  return onClick
    ? <button type="button" onClick={onClick} className={cls}>{inner}</button>
    : <div className={cls}>{inner}</div>
}
