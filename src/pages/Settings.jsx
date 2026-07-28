import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Back, RowIcon, Chevron } from '../components/icons'

export default function Settings() {
  const nav = useNavigate()
  const { disconnect } = useStore()
  const [appearance, setAppearance] = useState('dark')

  return (
    <div className="pb-4 max-w-2xl mx-auto">
      {/* header */}
      <div className="relative flex items-center justify-center h-14 mb-6">
        <button onClick={() => nav(-1)} className="absolute left-0 w-11 h-11 grid place-items-center rounded-full bg-white/5 border border-white/15">
          <Back size={20} />
        </button>
        <h1 className="font-serif text-3xl">Settings</h1>
      </div>

      <Section title="Account">
        <Row icon="editProfile" label="Edit profile" onClick={() => {}} />
        <Row icon="linkedSocials" label="Linked socials" onClick={() => {}} />
        <Row icon="appearance" label="Appearance" right={
          <div className="flex items-center gap-1 rounded-full p-1 bg-white/5 border border-white/10">
            {['auto', 'light', 'dark'].map((k) => (
              <button key={k} onClick={() => setAppearance(k)}
                className={`px-2.5 h-7 grid place-items-center rounded-full text-[11px] font-semibold capitalize ${
                  appearance === k ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent-hi)]' : 'text-[var(--color-ink-soft)]'
                }`}>
                {k}
              </button>
            ))}
          </div>
        } />
        <Row icon="gift" label="Add referral code" onClick={() => {}} last />
      </Section>

      <Section title="More">
        <Row icon="tos" label="Terms of service" onClick={() => {}} />
        <Row icon="privacy" label="Privacy policy" onClick={() => {}} />
        <Row icon="x" label="Follow us on X" onClick={() => {}} />
        <Row icon="support" label="Support" onClick={() => {}} />
        <Row icon="feedback" label="Feedback" onClick={() => {}} />
        <Row icon="docs" label="Docs" onClick={() => {}} last />
      </Section>

      {/* logout */}
      <div className="card overflow-hidden mb-3">
        <button
          onClick={() => { disconnect(); nav('/') }}
          className="w-full flex items-center gap-3 p-4 hover:bg-white/4"
        >
          <span className="w-9 h-9 grid place-items-center rounded-full border border-[rgba(255,93,108,.35)]" style={{ background: 'rgba(255,93,108,.08)' }}>
            <RowIcon name="logout" stroke="var(--color-down)" />
          </span>
          <span className="font-semibold text-[var(--color-down)]">Log out</span>
        </button>
      </div>

      <div className="text-center text-xs text-[var(--color-ink-soft)] mb-8">ESKA v0.1.0 · demo</div>

      <Section title="Advanced">
        <Row icon="wallet" label="Link wallet / EVM" onClick={() => {}} last />
      </Section>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="mb-7">
      <h2 className="font-serif text-2xl mb-3">{title}</h2>
      <div className="card overflow-hidden">{children}</div>
    </div>
  )
}

function Row({ icon, label, right, onClick, last }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-4 hover:bg-white/4 text-left ${last ? '' : 'border-b hairline'}`}
    >
      <span className="w-9 h-9 grid place-items-center rounded-full bg-white/5 border border-white/12"><RowIcon name={icon} /></span>
      <span className="font-semibold flex-1">{label}</span>
      {right ?? <Chevron />}
    </button>
  )
}
