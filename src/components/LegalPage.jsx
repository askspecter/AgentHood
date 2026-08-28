import { useNavigate } from 'react-router-dom'
import { Back } from './icons'

/**
 * Shared layout for the long-form legal pages (Terms, Privacy). Keeps both
 * reading the same: a back header, a "last updated" line, a lead paragraph, and
 * a stack of numbered sections rendered from plain content.
 */
export function LegalLayout({ title, updated, lead, children }) {
  const nav = useNavigate()
  return (
    <div className="max-w-2xl mx-auto pb-10">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => nav(-1)} className="grid place-items-center w-10 h-10 rounded-lg border hairline hover:bg-[var(--color-paper-2)]"><Back size={18} /></button>
        <h1 className="font-serif text-3xl">{title}</h1>
      </div>

      <div className="card p-6 sm:p-8">
        <div className="eyebrow mb-4">Last updated · {updated}</div>
        {lead && <p className="text-[var(--color-ink-soft)] leading-relaxed mb-7 text-[15px]">{lead}</p>}
        <div className="space-y-8">{children}</div>
      </div>

      <p className="text-[11px] text-[var(--color-ink-faint)] leading-relaxed mt-4 px-1">
        This document is provided for transparency about how AURN works and is written in plain language. It is not legal advice. For questions, reach us at <a className="text-[var(--color-accent)] hover:underline" href="mailto:contact@eska.fun">contact@eska.fun</a>.
      </p>
    </div>
  )
}

export function Sec({ n, title, children }) {
  return (
    <section>
      <h2 className="font-serif text-xl mb-2.5 flex items-baseline gap-2.5">
        <span className="font-mono text-sm text-[var(--color-ink-faint)]">{String(n).padStart(2, '0')}</span>
        <span>{title}</span>
      </h2>
      <div className="space-y-3 text-[var(--color-ink-soft)] leading-relaxed text-[15px]">{children}</div>
    </section>
  )
}

export function UL({ items }) {
  return (
    <ul className="space-y-2">
      {items.map((x, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-2 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--color-accent)' }} />
          <span className="flex-1">{x}</span>
        </li>
      ))}
    </ul>
  )
}
