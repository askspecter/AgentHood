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
      <span className="grid place-items-center w-7 h-7 rounded-lg bg-[var(--color-ink)] text-white font-serif text-lg leading-none">E</span>
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
      <header className="sticky top-0 z-40 border-b hairline bg-white/80 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 lg:px-8 h-16 flex items-center gap-6">
          <Link to="/"><Wordmark /></Link>

          <nav className="hidden md:flex items-center gap-1 ml-2">
            {TABS.map((t) => (
              <NavLink key={t.to} to={t.to} end={t.end}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    isActive ? 'text-[var(--color-ink)] bg-[#f4f4f5]' : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
                  }`}>
                {t.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setIntro(true)}
              className="hidden sm:grid place-items-center w-9 h-9 rounded-lg text-[var(--color-ink-soft)] hover:bg-[#f4f4f5] hover:text-[var(--color-ink)]"
              title="About ESKA"><Info size={18} /></button>
            <button onClick={() => nav('/create')} className="hidden sm:inline-flex btn btn-secondary">Create</button>
            {wallet ? (
              <Link to="/you" className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border hairline hover:bg-[#f4f4f5] transition">
                <span className="w-6 h-6 rounded-full grid place-items-center font-serif text-xs text-white"
                  style={{ background: 'linear-gradient(145deg,#818cf8,#4f46e5)' }}>Y</span>
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

      {/* ===== mobile bottom tab bar ===== */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/90 backdrop-blur-xl border-t hairline">
        <div className="grid grid-cols-4 max-w-md mx-auto">
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <NavLink key={t.to} to={t.to} end={t.end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                    isActive ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-faint)]'
                  }`}>
                {({ isActive }) => (<><Icon active={isActive} /><span>{t.label}</span></>)}
              </NavLink>
            )
          })}
          <button onClick={() => nav('/create')} className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-[var(--color-ink-faint)]">
            <span className="grid place-items-center w-6 h-6 rounded-full bg-[var(--color-ink)] text-white text-base leading-none">+</span>
            Create
          </button>
        </div>
      </nav>

      <IntroModal open={intro} onClose={() => setIntro(false)} />
    </div>
  )
}

function base(active) { return active ? 'var(--color-ink)' : 'currentColor' }
function HomeIcon({ active }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={base(active)} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" fill={active ? '#f4f4f5' : 'none'} /></svg>
}
function ChatIcon({ active }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={base(active)} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"><path d="M4 5h16v11H9l-4 3V5z" fill={active ? '#f4f4f5' : 'none'} /></svg>
}
function YouIcon({ active }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={base(active)} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"><circle cx="12" cy="8" r="4" fill={active ? '#f4f4f5' : 'none'} /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
}
