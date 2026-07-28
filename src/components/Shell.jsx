import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Info, XGlyph } from './icons'
import LoginButton from './WalletButton'
import IntroModal from './IntroModal'
import { usd } from '../lib/format'

const TABS = [
  { to: '/', label: 'Discover', end: true, icon: HomeIcon },
  { to: '/chats', label: 'Chats', icon: ChatIcon },
  { to: '/you', label: 'Portfolio', icon: YouIcon },
]

function Wordmark({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="orb-spin grid place-items-center w-7 h-7 rounded-[9px] font-bold text-sm leading-none"
        style={{ background: 'var(--holo)', color: '#0b0a12', boxShadow: '0 0 18px -4px rgba(180,150,255,0.8), inset 0 1px 0 rgba(255,255,255,0.6)' }}>E</span>
      <span className="font-semibold text-lg tracking-tight">ESKA</span>
    </span>
  )
}

export default function Shell() {
  const loc = useLocation()
  const nav = useNavigate()
  const { wallet, connect, cash } = useStore()
  const [intro, setIntro] = useState(false)

  return (
    <div className="min-h-full flex flex-col">
      {/* ===== desktop top navbar ===== */}
      <header className="sticky top-0 z-40 border-b hairline bg-[rgba(7,6,12,.68)] backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 lg:px-8 h-16 flex items-center gap-6">
          <Link to="/"><Wordmark /></Link>

          <nav className="hidden md:flex items-center gap-1 ml-2">
            {TABS.map((t) => (
              <NavLink key={t.to} to={t.to} end={t.end}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    isActive ? 'text-[var(--color-ink)] bg-[var(--color-paper-2)]' : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
                  }`}>
                {t.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setIntro(true)}
              className="hidden sm:grid place-items-center w-9 h-9 rounded-lg text-[var(--color-ink-soft)] hover:bg-[var(--color-paper-2)] hover:text-[var(--color-ink)]"
              title="About ESKA"><Info size={18} /></button>
            <button onClick={() => nav('/create')} className="hidden sm:inline-flex btn btn-secondary">Create</button>
            {wallet ? (
              <Link to="/you" className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border hairline hover:bg-[var(--color-paper-2)] transition">
                <span className="w-6 h-6 rounded-full grid place-items-center font-serif text-xs text-white"
                  style={{ background: 'linear-gradient(180deg,#9789ff,#6f5cf2)', color: '#fff' }}>Y</span>
                <span className="font-mono text-xs num font-medium">{usd(cash)}</span>
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
        <div className="pointer-events-auto flex items-center gap-2.5">
          {/* the pill */}
          <div className="flex items-center gap-1 rounded-[24px] p-1.5 border border-white/10
                          bg-[rgba(18,16,26,0.7)] backdrop-blur-2xl shadow-[0_18px_44px_-14px_rgba(0,0,0,0.85)]">
            {TABS.map((t) => {
              const Icon = t.icon
              return (
                <NavLink key={t.to} to={t.to} end={t.end}
                  className={({ isActive }) =>
                    `relative flex flex-col items-center justify-center gap-1 w-[62px] py-2 rounded-[18px] text-[11px] font-medium transition-colors ${
                      isActive ? 'text-white' : 'text-[var(--color-ink-faint)]'
                    }`}>
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute inset-0 rounded-[18px] pointer-events-none"
                          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.05))', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.28), 0 0 22px -6px rgba(180,150,255,0.55)' }} />
                      )}
                      <span className="relative"><Icon active={isActive} /></span>
                      <span className="relative">{t.label}</span>
                    </>
                  )}
                </NavLink>
              )
            })}
          </div>
          {/* separate holographic create button */}
          <button onClick={() => nav('/create')} aria-label="Create character"
            className="orb-spin grid place-items-center w-14 h-14 rounded-full shrink-0 active:scale-95 transition-transform"
            style={{ background: 'var(--holo)', boxShadow: '0 12px 32px -8px rgba(180,150,255,0.75), inset 0 1px 0 rgba(255,255,255,0.6)' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0b0a12" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </div>
      </div>

      <IntroModal open={intro} onClose={() => setIntro(false)} />
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
