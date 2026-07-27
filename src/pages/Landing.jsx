import { Link } from 'react-router-dom'
import { Logo } from '../components/Shell'
import CharmAvatar from '../components/CharmAvatar'
import { CHARMS } from '../data/charms'
import { usd, pct, num } from '../lib/format'

export default function Landing() {
  const featured = CHARMS.slice(0, 6)
  return (
    <div>
      {/* nav */}
      <header className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="font-serif text-xl">Charms</span>
        </div>
        <div className="flex items-center gap-2">
          <a href="#how" className="hidden sm:inline text-sm font-semibold text-[var(--color-ink-soft)] px-3 py-2">How it works</a>
          <a href="#charms" className="hidden sm:inline text-sm font-semibold text-[var(--color-ink-soft)] px-3 py-2">Charms</a>
          <Link to="/app" className="btn btn-primary text-sm">Open app</Link>
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto max-w-6xl px-4 pt-10 pb-16 text-center relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          {featured.map((c, i) => (
            <div key={c.id} className="absolute floaty" style={{
              left: `${[8, 82, 16, 74, 40, 60][i]}%`,
              top: `${[20, 30, 70, 66, 8, 82][i]}%`,
              animationDelay: `${i * 0.7}s`, opacity: 0.9,
            }}>
              <CharmAvatar charm={c} size={40 + (i % 3) * 14} />
            </div>
          ))}
        </div>

        <span className="chip mb-5">✦ The internet, but it talks back</span>
        <h1 className="font-serif text-5xl sm:text-7xl leading-[1.02] max-w-3xl mx-auto">
          Coins that feel <span className="italic">alive</span>.
        </h1>
        <p className="mt-5 text-lg text-[var(--color-ink-soft)] max-w-xl mx-auto">
          Find the next internet icon before the timeline does. Trade its coin,
          shape its lore, chat with it at 3am — or launch your own and watch it take on a life of its own.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link to="/app" className="btn btn-primary">Start exploring →</Link>
          <Link to="/app/create" className="btn btn-ghost">Launch a charm</Link>
        </div>

        <div className="mt-6 flex items-center justify-center gap-6 text-sm text-[var(--color-ink-soft)]">
          <span><b className="text-[var(--color-ink)]">{CHARMS.length}k+</b> charms alive</span>
          <span><b className="text-[var(--color-ink)]">$4.2M</b> traded</span>
          <span><b className="text-[var(--color-ink)]">240k</b> conversations</span>
        </div>
      </section>

      {/* ticker */}
      <div className="border-y border-[rgba(20,32,59,.08)] bg-white/50 py-3 overflow-hidden">
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

      {/* how it works */}
      <section id="how" className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="font-serif text-4xl text-center mb-3">Three ways to play</h2>
        <p className="text-center text-[var(--color-ink-soft)] mb-12 max-w-lg mx-auto">
          Every charm is an AI character with a personality, a story, and a coin. What you do with it is up to you.
        </p>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            ['🧭', 'Discover', 'Scroll a living feed of characters. Each one has a voice, a vibe, and a market. Get in early on the ones you believe in.'],
            ['💬', 'Shape the lore', 'Talk to a charm and it remembers. The community writes its story together — the best moments move the coin.'],
            ['✦', 'Launch your own', 'Give it a name, a look, and a soul. Mint its coin in seconds and let the timeline decide if it becomes an icon.'],
          ].map(([ic, t, d]) => (
            <div key={t} className="card p-6">
              <div className="text-3xl mb-3">{ic}</div>
              <h3 className="font-serif text-2xl mb-2">{t}</h3>
              <p className="text-[var(--color-ink-soft)] text-sm leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* charms grid */}
      <section id="charms" className="mx-auto max-w-6xl px-4 pb-20">
        <div className="flex items-end justify-between mb-6">
          <h2 className="font-serif text-4xl">Live right now</h2>
          <Link to="/app" className="text-sm font-semibold">See all →</Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {featured.map((c) => (
            <Link to={`/c/${c.id}`} key={c.id} className="card p-5 flex gap-4 items-center hover:-translate-y-0.5 transition-transform">
              <CharmAvatar charm={c} size={56} />
              <div className="min-w-0 flex-1">
                <div className="font-serif text-lg">{c.name}</div>
                <div className="text-sm text-[var(--color-ink-soft)] truncate">{c.tagline}</div>
                <div className="mt-1 text-xs font-mono">
                  {usd(c.price)} · <span className={c.change24 >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}>{pct(c.change24)}</span> · {num(c.followers)} fans
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* cta */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="card p-10 text-center relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full" style={{ background: 'radial-gradient(circle,#CBE2FC,transparent)' }} />
          <h2 className="font-serif text-4xl mb-3">Who will you bring to life?</h2>
          <p className="text-[var(--color-ink-soft)] mb-6 max-w-md mx-auto">
            The next icon of the internet is one idea away. It might as well be yours.
          </p>
          <Link to="/app/create" className="btn btn-primary">Launch your charm</Link>
        </div>
      </section>

      <footer className="border-t border-[rgba(20,32,59,.08)] py-10">
        <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[var(--color-ink-soft)]">
          <div className="flex items-center gap-2"><Logo size={22} /> <span className="font-serif text-lg text-[var(--color-ink)]">Charms</span></div>
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
