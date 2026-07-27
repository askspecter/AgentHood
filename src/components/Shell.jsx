import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import WalletButton from './WalletButton'

const TABS = [
  { to: '/app', label: 'Explore', icon: '🧭', end: true },
  { to: '/app/chats', label: 'Chats', icon: '💬' },
  { to: '/app/create', label: 'Create', icon: '✦' },
  { to: '/app/profile', label: 'Profile', icon: '👤' },
]

export default function Shell() {
  const loc = useLocation()
  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-40 backdrop-blur bg-white/60 border-b border-[rgba(20,32,59,.08)]">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <Link to="/app" className="flex items-center gap-2">
            <Logo />
            <span className="font-serif text-xl">Charms</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {TABS.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-full text-sm font-semibold transition ${
                    isActive ? 'bg-[var(--color-ink)] text-white' : 'text-[var(--color-ink-soft)] hover:bg-white'
                  }`
                }
              >
                {t.label}
              </NavLink>
            ))}
          </nav>
          <WalletButton />
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6 pb-28 md:pb-10" key={loc.pathname}>
        <Outlet />
      </main>

      {/* mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/85 backdrop-blur border-t border-[rgba(20,32,59,.1)]">
        <div className="flex items-stretch justify-around max-w-md mx-auto">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${
                  isActive ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-soft)]'
                }`
              }
            >
              <span className="text-lg leading-none">{t.icon}</span>
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

export function Logo({ size = 28, glow = false }) {
  return (
    <span
      className="grid place-items-center font-serif"
      style={{
        width: size, height: size, borderRadius: size * 0.34,
        background: glow
          ? 'radial-gradient(circle at 30% 25%, #ffffff, #cfe4ff 70%)'
          : 'linear-gradient(135deg,#CBE2FC,#5b9bf5)',
        color: glow ? '#1668e3' : '#14203b',
        boxShadow: glow
          ? '0 0 18px rgba(255,255,255,.9), 0 6px 16px -6px rgba(20,60,140,.6)'
          : '0 6px 14px -6px rgba(20,32,59,.5)',
        fontSize: size * 0.62,
      }}
    >
      C
    </span>
  )
}
