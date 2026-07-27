import { Link } from 'react-router-dom'
import { Logo } from '../components/Shell'
import CharmAvatar from '../components/CharmAvatar'
import { CHARMS } from '../data/charms'
import { usd, pct, num } from '../lib/format'

export default function Landing() {
  const featured = CHARMS.slice(0, 6)
  return (
    <div>
      {/* ===== HERO: blue sky + clouds ===== */}
      <section className="sky clouds relative overflow-hidden">
        {/* drifting characters in the sky */}
        <div className="pointer-events-none absolute inset-0 cloud-drift">
          {featured.map((c, i) => (
            <div key={c.id} className="absolute floaty" style={{
              left: `${[7, 84, 14, 78, 30, 66][i]}%`,
              top: `${[24, 20, 60, 52, 12, 40][i]}%`,
              animationDelay: `${i * 0.8}s`,
              opacity: 0.95,
              filter: 'drop-shadow(0 10px 22px rgba(10,40,110,.35))',
            }}>
              <CharmAvatar charm={c} size={38 + (i % 3) * 16} />
            </div>
          ))}
        </div>

        {/* nav */}
        <header className="relative z-10 mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Logo glow />
            <span className="font-serif text-2xl wordmark">Charms</span>
          </div>
          <div className="flex items-center gap-2">
            <a href="#how" className="hidden sm:inline text-sm font-semibold text-white/90 hover:text-white px-3 py-2">How it works</a>
            <a href="#charms" className="hidden sm:inline text-sm font-semibold text-white/90 hover:text-white px-3 py-2">Charms</a>
            <Link to="/app" className="btn btn-white text-sm">Open app</Link>
          </div>
        </header>

        {/* hero copy */}
        <div className="relative z-10 mx-auto max-w-5xl px-4 pt-16 pb-40 text-center">
          <span className="glass inline-flex text-white text-xs font-semibold px-4 py-1.5 mb-8">
            ✦ The internet, but it talks back
          </span>
          <h1 className="wordmark font-serif leading-[0.95] text-white" style={{ fontSize: 'clamp(3.5rem, 12vw, 9rem)' }}>
            Charms
          </h1>
          <p className="mt-4 font-serif text-white text-2xl sm:text-3xl">
            Coins that feel <span className="italic">alive</span>.
          </p>
          <p className="mt-5 text-white/90 text-lg max-w-xl mx-auto">
            Meet characters worth owning. Find the next internet icon before the timeline does —
            trade its coin, shape its lore, or bring your own to life.
          </p>
          <div className="mt-9 flex items-center justify-center gap-3">
            <Link to="/app" className="btn btn-white">Start exploring →</Link>
            <Link to="/app/create" className="btn btn-glass">Launch a charm</Link>
          </div>
          <div className="mt-8 flex items-center justify-center gap-6 text-sm text-white/85">
            <span><b className="text-white">{CHARMS.length}k+</b> charms alive</span>
            <span className="opacity-50">·</span>
            <span><b className="text-white">$4.2M</b> traded</span>
            <span className="opacity-50">·</span>
            <span><b className="text-white">240k</b> conversations</span>
          </div>
        </div>
      </section>

      {/* ===== ticker ===== */}
      <div className="bg-white border-b border-[rgba(20,32,59,.08)] py-3 overflow-hidden -mt-1">
        <div className="marquee">
          {[...featured, ...featured].map((c, i) => (
            <span key={i} className="flex items-center gap-2 text-sm">
              <span>{c.emoji}</span>
              <span className="font-mono font-semibold">${c.ticker}</span>
              <span className="font-mono">{usd(c.price)}</span>
              <span className={c.change24 >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}>{pct(c.change24)}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ===== how it works ===== */}
      <section id="how" className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="font-serif text-5xl text-center mb-3">Three ways to play</h2>
          <p className="text-center text-[var(--color-ink-soft)] mb-12 max-w-lg mx-auto">
            Every charm is an AI character with a personality, a story, and a coin. What you do with it is up to you.
          </p>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              ['🧭', 'Discover', 'Scroll a living feed of characters. Each one has a voice, a vibe, and a market. Get in early on the ones you believe in.'],
              ['💬', 'Shape the lore', 'Talk to a charm and it remembers. The community writes its story together — the best moments move the coin.'],
              ['✦', 'Launch your own', 'Give it a name, a look, and a soul. Mint its coin in seconds and let the timeline decide if it becomes an icon.'],
            ].map(([ic, t, d]) => (
              <div key={t} className="card p-7">
                <div className="text-3xl mb-4">{ic}</div>
                <h3 className="font-serif text-3xl mb-2">{t}</h3>
                <p className="text-[var(--color-ink-soft)] leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== charms grid ===== */}
      <section id="charms" className="sky-soft">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="flex items-end justify-between mb-8">
            <h2 className="font-serif text-5xl">Live right now</h2>
            <Link to="/app" className="text-sm font-semibold text-[var(--color-sky-top)]">See all →</Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featured.map((c) => (
              <Link to={`/c/${c.id}`} key={c.id} className="card p-5 flex gap-4 items-center hover:-translate-y-0.5 transition-transform">
                <CharmAvatar charm={c} size={58} />
                <div className="min-w-0 flex-1">
                  <div className="font-serif text-xl">{c.name}</div>
                  <div className="text-sm text-[var(--color-ink-soft)] truncate">{c.tagline}</div>
                  <div className="mt-1 text-xs font-mono">
                    {usd(c.price)} · <span className={c.change24 >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}>{pct(c.change24)}</span> · {num(c.followers)} fans
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA over sky ===== */}
      <section className="sky clouds relative overflow-hidden">
        <div className="relative z-10 mx-auto max-w-3xl px-4 py-28 text-center">
          <h2 className="wordmark font-serif text-white text-5xl sm:text-6xl mb-4">Who will you bring to life?</h2>
          <p className="text-white/90 mb-8 max-w-md mx-auto text-lg">
            The next icon of the internet is one idea away. It might as well be yours.
          </p>
          <Link to="/app/create" className="btn btn-white">Launch your charm</Link>
        </div>
      </section>

      {/* ===== footer ===== */}
      <footer className="bg-white border-t border-[rgba(20,32,59,.08)] py-10">
        <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[var(--color-ink-soft)]">
          <div className="flex items-center gap-2"><Logo size={24} /> <span className="font-serif text-xl text-[var(--color-ink)]">Charms</span></div>
          <div className="flex gap-5">
            <a href="#how">How it works</a>
            <a href="#charms">Charms</a>
            <Link to="/app">App</Link>
          </div>
          <span>A demo clone · not affiliated with charms.ai</span>
        </div>
      </footer>
    </div>
  )
}
