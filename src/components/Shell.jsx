import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import LoginButton from './WalletButton'

const TABS = [
  { to: '/', label: 'Discover', end: true, icon: HomeIcon },
  { to: '/chats', label: 'Chat', icon: ChatIcon },
  { to: '/you', label: 'Portfolio', icon: YouIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

function Wordmark({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <img src="/eska-logo.png" alt="ESKA" width="28" height="28"
        className="w-7 h-7 rounded-[9px] object-cover shrink-0"
        style={{ boxShadow: '0 0 18px -6px rgba(180,150,255,0.7), inset 0 1px 0 rgba(255,255,255,0.4)' }} />
      <span className="eska-type" role="img" aria-label="ESKA" style={{ fontSize: 17 }} />
    </span>
  )
}

export default function Shell() {
  const loc = useLocation()
  const nav = useNavigate()
  const { wallet } = useStore()

  return (
    <div className="min-h-full flex flex-col">
      {/* ===== desktop top navbar ===== */}
      <header className="sticky top-0 z-40 border-b hairline bg-[var(--nav-bg)] backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 lg:px-8 h-16 flex items-center gap-6">
          <Link to="/"><Wordmark /></Link>

          <nav className="hidden md:flex items-center gap-1 ml-2">
            {[...TABS, { to: '/trade', label: 'Trade' }, { to: '/launch', label: 'Launch' }].map((t) => (
              <NavLink key={t.to} to={t.to} end={t.end}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    isActive ? 'text-[var(--color-ink)] bg-[var(--color-paper-2)]' : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
                  }`}>
                {t.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center">
            {wallet ? (
              <Link to="/you" className="flex items-center gap-2 pl-1 pr-3.5 py-1 rounded-full border hairline hover:bg-[var(--color-paper-2)] transition max-w-[190px]">
                <span className="shrink-0 p-[1.5px] rounded-full" style={{ background: 'var(--holo)' }}>
                  {wallet.avatar ? (
                    <img src={wallet.avatar} alt="" className="w-6 h-6 rounded-full object-cover block" />
                  ) : (
                    <span className="w-6 h-6 rounded-full grid place-items-center font-semibold text-[11px] bg-[var(--color-paper)] text-[var(--color-ink)]">{(wallet.handle?.replace(/^@/, '')[0] || 'Y').toUpperCase()}</span>
                  )}
                </span>
                <span className="text-sm font-medium truncate leading-none">{wallet.handle}</span>
              </Link>
            ) : (
              <LoginButton />
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full mx-auto max-w-6xl px-4 lg:px-8 pt-6 pb-28 md:pb-16" key={loc.pathname}>
        <Outlet />
      </main>

      {/* ===== mobile floating pill nav ===== */}
      <div className="md:hidden fixed inset-x-0 z-40 flex justify-center px-4 pointer-events-none"
        style={{ bottom: 'calc(0.7rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="pointer-events-auto flex items-center gap-1 rounded-[24px] p-1.5 border border-[var(--pill-border)]
                        bg-[var(--pill-bg)] backdrop-blur-2xl shadow-[0_18px_44px_-14px_rgba(0,0,0,0.55)]">
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <NavLink key={t.to} to={t.to} end={t.end}
                className={({ isActive }) =>
                  `relative flex flex-col items-center justify-center gap-1 w-[56px] py-2 rounded-[18px] text-[11px] font-medium transition-colors ${
                    isActive ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-faint)]'
                  }`}>
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute inset-0 rounded-[18px] pointer-events-none"
                        style={{ background: 'var(--pill-active)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.28), 0 0 22px -6px rgba(180,150,255,0.55)' }} />
                    )}
                    <span className="relative h-6 grid place-items-center"><Icon active={isActive} /></span>
                    <span className="relative leading-none">{t.label}</span>
                  </>
                )}
              </NavLink>
            )
          })}
          {/* Launch — the holographic action inside the pill */}
          <button onClick={() => nav('/launch')} aria-label="Launch a coin"
            className="flex flex-col items-center justify-center gap-1 w-[56px] py-2 rounded-[18px] text-[11px] font-medium text-[var(--color-ink-faint)] active:scale-95 transition-transform">
            <span className="relative h-6 grid place-items-center">
              <span className="orb-spin grid place-items-center w-6 h-6 rounded-full"
                style={{ background: 'var(--holo)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55), 0 0 14px -3px rgba(180,150,255,0.85)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0b0a12" strokeWidth="3.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              </span>
            </span>
            <span className="relative leading-none">Launch</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function base(active) { return active ? 'var(--color-ink)' : 'currentColor' }
function HomeIcon({ active }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={base(active)} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" fill={active ? 'var(--color-paper-2)' : 'none'} /></svg>
}
function ChatIcon({ active }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={base(active)} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"><path d="M4 5h16v11H9l-4 3V5z" fill={active ? 'var(--color-paper-2)' : 'none'} /></svg>
}
function YouIcon({ active }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={base(active)} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"><circle cx="12" cy="8" r="4" fill={active ? 'var(--color-paper-2)' : 'none'} /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
}
function SettingsIcon({ active }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={base(active)} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"><circle cx="12" cy="12" r="3.2" fill={active ? 'var(--color-paper-2)' : 'none'} /><path d="M12 2.8v2.4M12 18.8v2.4M4.3 7.2l2 1.2M17.7 15.6l2 1.2M4.3 16.8l2-1.2M17.7 8.4l2-1.2" /></svg>
}
