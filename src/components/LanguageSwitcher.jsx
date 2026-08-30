import { useEffect, useRef, useState } from 'react'
import { LANGS, useLang, useT } from '../lib/i18n'

/**
 * A compact globe language picker for the header. Shows the current language and
 * opens a small menu of English / 中文 / 한국어. Closes on outside click or Escape.
 */
export default function LanguageSwitcher() {
  const { lang, setLang } = useLang()
  const t = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = LANGS.find((l) => l.code === lang) || LANGS[0]

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t('lang.choose')}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 h-9 pl-2.5 pr-2 rounded-full border hairline text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] transition"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" />
        </svg>
        <span className="text-[12px] font-semibold tracking-wide tabular-nums">{current.short}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6" /></svg>
      </button>

      {open && (
        <div role="listbox"
          className="absolute right-0 mt-2 w-40 z-50 rounded-2xl border hairline bg-[var(--nav-bg)] backdrop-blur-xl p-1.5 shadow-[0_18px_44px_-14px_rgba(0,0,0,0.55)] fade-up">
          {LANGS.map((l) => {
            const active = l.code === lang
            return (
              <button key={l.code} role="option" aria-selected={active}
                onClick={() => { setLang(l.code); setOpen(false) }}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-sm transition ${
                  active ? 'text-[var(--color-ink)] bg-[var(--color-paper-2)]' : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper-2)]'
                }`}>
                <span className="font-medium">{l.label}</span>
                {active && (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
