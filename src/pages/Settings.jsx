import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Back, RowIcon, Chevron } from '../components/icons'

export default function Settings() {
  const nav = useNavigate()
  const { disconnect } = useStore()
  const [appearance, setAppearance] = useState('light')

  return (
    <div className="pb-4">
      {/* header */}
      <div className="relative flex items-center justify-center h-14 mb-4">
        <button onClick={() => nav(-1)} className="absolute left-0 w-11 h-11 grid place-items-center rounded-full bg-white/80 shadow-sm">
          <Back size={22} />
        </button>
        <h1 className="font-serif text-3xl">Settings</h1>
      </div>

      <Section title="Account">
        <Row icon="editProfile" label="Edit Profile" onClick={() => {}} />
        <Row icon="linkedSocials" label="Linked Socials" onClick={() => {}} />
        <Row icon="appearance" label="Appearance" right={
          <div className="flex items-center gap-1 bg-white/70 rounded-full p-1">
            {[['auto', '◐'], ['light', '☀'], ['dark', '☾']].map(([k, ic]) => (
              <button key={k} onClick={() => setAppearance(k)}
                className={`w-8 h-8 grid place-items-center rounded-full text-sm ${appearance === k ? 'bg-white shadow text-[var(--color-ink)]' : 'text-[var(--color-ink-soft)]'}`}>
                {ic}
              </button>
            ))}
          </div>
        } />
        <Row icon="gift" label="Add Referral code" onClick={() => {}} last />
      </Section>

      <Section title="More">
        <Row icon="tos" label="Terms of Service" onClick={() => {}} />
        <Row icon="privacy" label="Privacy Policy" onClick={() => {}} />
        <Row icon="x" label="Follow us on X" onClick={() => {}} />
        <Row icon="support" label="Support" onClick={() => {}} />
        <Row icon="feedback" label="Feedback" onClick={() => {}} />
        <Row icon="docs" label="Docs" onClick={() => {}} last />
      </Section>

      {/* logout */}
      <div className="card overflow-hidden mb-3">
        <button
          onClick={() => { disconnect(); nav('/') }}
          className="w-full flex items-center gap-3 p-4 hover:bg-white/60"
        >
          <span className="w-9 h-9 grid place-items-center rounded-full bg-[rgba(240,68,82,.12)]"><RowIcon name="logout" stroke="var(--color-down)" /></span>
          <span className="font-semibold text-[var(--color-down)]">Logout</span>
        </button>
      </div>

      <div className="text-center text-xs text-[var(--color-ink-soft)] mb-6">v0.0.11 · demo clone</div>

      <Section title="Advanced">
        <Row icon="wallet" label="Link Wallet (EVM)" onClick={() => {}} last />
      </Section>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <h2 className="font-serif text-2xl mb-3">{title}</h2>
      <div className="card overflow-hidden">{children}</div>
    </div>
  )
}

function Row({ icon, label, right, onClick, last }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-4 hover:bg-white/50 text-left ${last ? '' : 'border-b border-[rgba(20,32,59,.07)]'}`}
    >
      <span className="w-9 h-9 grid place-items-center rounded-full bg-[rgba(47,125,255,.1)]"><RowIcon name={icon} /></span>
      <span className="font-semibold flex-1">{label}</span>
      {right ?? <Chevron />}
    </button>
  )
}
