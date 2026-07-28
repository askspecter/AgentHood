import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Info, Crown, Search } from './icons'
import LoginButton from './WalletButton'
import IntroModal from './IntroModal'

const TABS = [
  { to: '/', label: 'Home', end: true, icon: HomeIcon },
  { to: '/chats', label: 'Chats', icon: ChatIcon },
  { to: '/you', label: 'You', icon: YouIcon },
]

export default function Shell() {
  const loc = useLocation()
  const nav = useNavigate()
  const { wallet } = useStore()
  const [intro, setIntro] = useState(false)
  const ownHeader = loc.pathname.startsWith('/you') || loc.pathname.startsWith('/settings')

  return (
    <div className="min-h-full flex flex-col">
      {!ownHeader && (
        <header className="relative z-30">
          {wallet ? (
            <div className="mx-auto max-w-2xl px-4 h-16 flex items-center justify-center relative">
              <Link to="/" className="wordmark text-2xl">ESKA</Link>
              <div className="absolute right-4 flex items-center gap-2.5">
                <button onClick={() => nav('/')} className="w-10 h-10 grid place-items-center rounded-full bg-white/5 border border-white/15" title="Search"><Search size={17} /></button>
                <button className="w-10 h-10 grid place-items-center rounded-full bg-white/5 border border-white/15" title="Premium"><Crown size={17} /></button>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl px-4 h-16 flex items-center justify-between">
              <Link to="/" className="wordmark text-2xl">ESKA</Link>
              <div className="flex items-center gap-2.5">
                <button onClick={() => setIntro(true)} className="grid place-items-center" title="About"><Info size={26} /></button>
                <button className="w-9 h-9 grid place-items-center rounded-full bg-white/5 border border-white/15" title="Premium"><Crown size={16} /></button>
                <LoginButton />
              </div>
            </div>
          )}
        </header>
      )}

      <main className="flex-1 mx-auto w-full max-w-2xl px-4 pt-2 pb-32" key={loc.pathname}>
        <Outlet />
      </main>

      {/* floating bottom nav */}
      <nav className="fixed bottom-4 inset-x-0 z-40 flex justify-center items-center gap-3 px-4">
        <div className="flex items-center gap-1 rounded-full p-1.5 border border-white/12"
          style={{ background: 'rgba(10,12,18,.82)', backdropFilter: 'blur(20px)', boxShadow: '0 18px 50px -18px rgba(0,0,0,.9)' }}>
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-0.5 w-16 py-1.5 rounded-full text-[11px] font-semibold transition ${
                    isActive ? 'text-[var(--color-accent-hi)] bg-[var(--color-accent-dim)]' : 'text-[var(--color-ink-soft)]'
                  }`
                }
              >
                {({ isActive }) => (<><Icon active={isActive} /><span>{t.label}</span></>)}
              </NavLink>
            )
          })}
        </div>
        <button
          onClick={() => nav('/create')}
          className="w-14 h-14 grid place-items-center rounded-full text-2xl font-light border border-white/20"
          style={{
            background: 'linear-gradient(180deg,#f0c37b,#b07f33)',
            color: '#14110a',
            boxShadow: '0 12px 32px -8px rgba(217,165,82,.55)',
          }}
          title="Create a character"
        >
          +
        </button>
      </nav>

      <IntroModal open={intro} onClose={() => setIntro(false)} />
    </div>
  )
}

/* ---- inline tab icons ---- */
function base(active) { return active ? 'var(--color-accent-hi)' : 'var(--color-ink-soft)' }
function HomeIcon({ active }) {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={base(active)} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" fill={active ? 'rgba(217,165,82,.16)' : 'none'} /></svg>
}
function ChatIcon({ active }) {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={base(active)} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"><path d="M4 5h16v11H9l-4 3V5z" fill={active ? 'rgba(217,165,82,.16)' : 'none'} /></svg>
}
function YouIcon({ active }) {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={base(active)} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"><circle cx="12" cy="8" r="4" fill={active ? 'rgba(217,165,82,.16)' : 'none'} /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
}
