import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Info, Crown, Search } from './icons'
import LoginButton from './WalletButton'

const TABS = [
  { to: '/', label: 'Home', end: true, icon: HomeIcon },
  { to: '/chats', label: 'Chats', icon: ChatIcon },
  { to: '/you', label: 'You', icon: YouIcon },
]

export default function Shell() {
  const loc = useLocation()
  const nav = useNavigate()
  const { wallet } = useStore()
  const ownHeader = loc.pathname.startsWith('/you') || loc.pathname.startsWith('/settings')

  return (
    <div className="min-h-full flex flex-col sky-soft">
      {/* faint clouds at very top */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-40 -z-10"
        style={{ background: 'radial-gradient(120% 100% at 50% 0%, #cfe6ff 0%, transparent 70%)' }} />

      {!ownHeader && (
        <header className="relative z-30">
          {wallet ? (
            <div className="mx-auto max-w-2xl px-4 h-16 flex items-center justify-center relative">
              <Link to="/" className="font-serif text-3xl text-[var(--color-ink)]">Charms</Link>
              <div className="absolute right-4 flex items-center gap-2.5">
                <button onClick={() => nav('/')} className="w-10 h-10 grid place-items-center rounded-full bg-white/80 shadow-sm" title="Search"><Search size={18} /></button>
                <button className="w-10 h-10 grid place-items-center rounded-full bg-white/80 shadow-sm" title="Premium"><Crown size={18} /></button>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl px-4 h-16 flex items-center justify-between">
              <Link to="/" className="font-serif text-3xl text-[var(--color-ink)]">Charms</Link>
              <div className="flex items-center gap-2.5">
                <button className="grid place-items-center" title="About"><Info size={24} /></button>
                <button className="w-9 h-9 grid place-items-center rounded-full bg-white shadow-sm" title="Premium"><Crown size={18} /></button>
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
        <div className="flex items-center gap-1 bg-white/85 backdrop-blur-xl rounded-full p-1.5 shadow-[0_12px_40px_-12px_rgba(20,40,90,.4)] border border-white/70">
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-0.5 w-16 py-1.5 rounded-full text-[11px] font-semibold transition ${
                    isActive ? 'text-[var(--color-sky-deep)] bg-[rgba(47,125,255,.12)]' : 'text-[var(--color-ink-soft)]'
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
          className="w-14 h-14 grid place-items-center rounded-full bg-[var(--color-sky-deep)] text-white text-3xl shadow-[0_12px_28px_-8px_rgba(47,125,255,.9)] border-4 border-white/80"
          title="Create a charm"
        >
          +
        </button>
      </nav>
    </div>
  )
}

/* ---- inline tab icons ---- */
function base(active) { return active ? 'var(--color-sky-deep)' : 'var(--color-ink-soft)' }
function HomeIcon({ active }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={base(active)} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round"><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" fill={active ? 'rgba(47,125,255,.18)' : 'none'} /></svg>
}
function ChatIcon({ active }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={base(active)} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round"><path d="M4 5h16v11H9l-4 3V5z" fill={active ? 'rgba(47,125,255,.18)' : 'none'} /></svg>
}
function YouIcon({ active }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={base(active)} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round"><circle cx="12" cy="8" r="4" fill={active ? 'rgba(47,125,255,.18)' : 'none'} /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
}

/* legacy logo used by other screens */
export function Logo({ size = 28, glow = false }) {
  return (
    <span className="grid place-items-center font-serif" style={{
      width: size, height: size, borderRadius: size * 0.34,
      background: glow ? 'radial-gradient(circle at 30% 25%, #ffffff, #cfe4ff 70%)' : 'linear-gradient(135deg,#CBE2FC,#5b9bf5)',
      color: glow ? '#1668e3' : '#14203b',
      boxShadow: glow ? '0 0 18px rgba(255,255,255,.9)' : '0 6px 14px -6px rgba(20,32,59,.5)',
      fontSize: size * 0.62,
    }}>C</span>
  )
}
