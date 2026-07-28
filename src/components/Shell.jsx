import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Info, Crown, XGlyph } from './icons'
import LoginButton from './WalletButton'
import IntroModal from './IntroModal'
import { usd } from '../lib/format'

const TABS = [
  { to: '/', label: 'Home', end: true, icon: HomeIcon },
  { to: '/chats', label: 'Chats', icon: ChatIcon },
  { to: '/you', label: 'You', icon: YouIcon },
]

export default function Shell() {
  const loc = useLocation()
  const nav = useNavigate()
  const { wallet, connect, cash } = useStore()
  const [intro, setIntro] = useState(false)
  const ownHeader = loc.pathname.startsWith('/you') || loc.pathname.startsWith('/settings')

  return (
    <div className="min-h-full">
      {/* ===== desktop sidebar ===== */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 z-40 flex-col px-5 py-7 border-r border-white/8"
        style={{ background: 'rgba(7,8,13,.72)', backdropFilter: 'blur(20px)' }}>
        <Link to="/" className="wordmark text-2xl block mb-10 pl-2">ESKA</Link>

        <nav className="flex flex-col gap-1.5">
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <NavLink key={t.to} to={t.to} end={t.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                    isActive
                      ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent-hi)] shadow-[inset_0_0_0_1px_rgba(217,165,82,.35)]'
                      : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] hover:bg-white/4'
                  }`}>
                {({ isActive }) => (<><Icon active={isActive} /><span>{t.label}</span></>)}
              </NavLink>
            )
          })}
        </nav>

        <button onClick={() => nav('/create')}
          className="btn btn-primary w-full mt-6 !py-3 text-sm">
          Create a character
        </button>

        <div className="mt-auto space-y-3">
          <button onClick={() => setIntro(true)}
            className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm font-semibold text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] hover:bg-white/4 w-full">
            <Info size={20} /> About ESKA
          </button>

          {wallet ? (
            <Link to="/you" className="card flex items-center gap-3 p-3 hover:bg-white/4">
              <span className="w-9 h-9 rounded-full grid place-items-center font-serif text-lg border border-white/20 shrink-0"
                style={{ background: 'radial-gradient(120% 120% at 30% 22%, #6b5a9e, #201a38)' }}>Y</span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold truncate">{wallet.handle}</span>
                <span className="block font-mono text-xs text-[var(--color-ink-soft)]">{usd(cash)}</span>
              </span>
            </Link>
          ) : (
            <button onClick={connect}
              className="btn w-full text-sm !py-2.5 bg-black text-white border border-white/25 hover:bg-[#111]">
              <XGlyph size={13} color="#fff" /> Log in with X
            </button>
          )}
        </div>
      </aside>

      {/* ===== content column ===== */}
      <div className="lg:pl-64 min-h-full flex flex-col">
        {/* mobile header */}
        {!ownHeader && (
          <header className="lg:hidden relative z-30">
            {wallet ? (
              <div className="px-4 h-16 flex items-center justify-center relative">
                <Link to="/" className="wordmark text-2xl">ESKA</Link>
                <div className="absolute right-4 flex items-center gap-2.5">
                  <button className="w-10 h-10 grid place-items-center rounded-full bg-white/5 border border-white/15" title="Premium"><Crown size={16} /></button>
                </div>
              </div>
            ) : (
              <div className="px-4 h-16 flex items-center justify-between">
                <Link to="/" className="wordmark text-2xl">ESKA</Link>
                <div className="flex items-center gap-2.5">
                  <button onClick={() => setIntro(true)} className="grid place-items-center" title="About"><Info size={26} /></button>
                  <LoginButton />
                </div>
              </div>
            )}
          </header>
        )}

        <main className="flex-1 w-full px-4 lg:px-10 pt-2 lg:pt-8 pb-32 lg:pb-16" key={loc.pathname}>
          <Outlet />
        </main>
      </div>

      {/* ===== mobile bottom nav ===== */}
      <nav className="lg:hidden fixed bottom-4 inset-x-0 z-40 flex justify-center items-center gap-3 px-4">
        <div className="flex items-center gap-1 rounded-full p-1.5 border border-white/12"
          style={{ background: 'rgba(10,12,18,.85)', backdropFilter: 'blur(20px)', boxShadow: '0 18px 50px -18px rgba(0,0,0,.9)' }}>
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <NavLink key={t.to} to={t.to} end={t.end}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-0.5 w-16 py-1.5 rounded-full text-[11px] font-semibold transition ${
                    isActive ? 'text-[var(--color-accent-hi)] bg-[var(--color-accent-dim)]' : 'text-[var(--color-ink-soft)]'
                  }`}>
                {({ isActive }) => (<><Icon active={isActive} /><span>{t.label}</span></>)}
              </NavLink>
            )
          })}
        </div>
        <button onClick={() => nav('/create')}
          className="w-14 h-14 grid place-items-center rounded-full text-2xl font-light border border-white/20"
          style={{ background: 'linear-gradient(180deg,#f0c37b,#b07f33)', color: '#14110a', boxShadow: '0 12px 32px -8px rgba(217,165,82,.55)' }}
          title="Create a character">
          +
        </button>
      </nav>

      <IntroModal open={intro} onClose={() => setIntro(false)} />
    </div>
  )
}

/* ---- inline tab icons ---- */
function base(active) { return active ? 'var(--color-accent-hi)' : 'currentColor' }
function HomeIcon({ active }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={base(active)} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" fill={active ? 'rgba(217,165,82,.16)' : 'none'} /></svg>
}
function ChatIcon({ active }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={base(active)} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"><path d="M4 5h16v11H9l-4 3V5z" fill={active ? 'rgba(217,165,82,.16)' : 'none'} /></svg>
}
function YouIcon({ active }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={base(active)} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"><circle cx="12" cy="8" r="4" fill={active ? 'rgba(217,165,82,.16)' : 'none'} /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
}
