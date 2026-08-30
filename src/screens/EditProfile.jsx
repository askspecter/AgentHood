import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import { Back, Verified } from '../components/icons'

/**
 * Edit profile - the display name and photo only.
 *
 * The username is your wallet address and can't be changed here (it's your
 * on-chain identity). Name and photo are local overrides layered on top of it:
 * saved on this device, shown everywhere the app shows "you", and resettable
 * back to the plain address.
 */

// Shrink any picked image to a small square data URL - keeps localStorage light
// and the avatar crisp at the sizes we render it.
function fileToAvatar(file, size = 256) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = size
        const ctx = canvas.getContext('2d')
        const s = Math.min(img.width, img.height)
        const sx = (img.width - s) / 2
        const sy = (img.height - s) / 2
        ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

export default function EditProfile() {
  const nav = useNavigate()
  const { wallet, connect, updateProfile } = useStore()
  const tr = useT()
  const fileRef = useRef(null)

  const [name, setName] = useState(wallet?.name || '')
  const [avatar, setAvatar] = useState(wallet?.avatar || null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  if (!wallet) {
    return (
      <div className="max-w-md mx-auto text-center py-24">
        <h1 className="font-serif text-3xl mb-2">{tr('settings.editProfile', 'Edit profile')}</h1>
        <p className="text-[var(--color-ink-soft)] mb-7">{tr('edit.connectBody', 'Connect your wallet to edit your name and photo.')}</p>
        <button onClick={connect} className="btn btn-primary mx-auto">{tr('wallet.connect', 'Connect Wallet')}</button>
      </div>
    )
  }

  const handle = wallet.handle
  const dirty = name !== (wallet.name || '') || avatar !== (wallet.avatar || null)

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // let the same file be re-picked later
    if (!file) return
    if (!/^image\//.test(file.type)) { setError(tr('edit.errImage', 'Please choose an image file.')); return }
    setError(null); setBusy(true)
    try {
      setAvatar(await fileToAvatar(file))
    } catch {
      setError(tr('edit.errRead', 'That image could not be read. Try another.'))
    } finally {
      setBusy(false)
    }
  }

  const save = () => {
    updateProfile({
      displayName: name.trim() && name.trim() !== wallet.baseName ? name.trim() : null,
      avatar: avatar && avatar !== wallet.baseAvatar ? avatar : null,
    })
    setSaved(true)
    setTimeout(() => nav(-1), 550)
  }

  const resetToX = () => {
    updateProfile({ displayName: null, avatar: null })
    setName(wallet.baseName || '')
    setAvatar(wallet.baseAvatar || null)
  }

  const initial = (handle?.replace(/^@/, '')[0] || 'Y').toUpperCase()
  const usingXPhoto = avatar === wallet.baseAvatar
  const usingXName = name === (wallet.baseName || '')

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => nav(-1)} className="grid place-items-center w-10 h-10 rounded-lg border hairline hover:bg-[var(--color-paper-2)]"><Back size={18} /></button>
        <h1 className="font-serif text-3xl">{tr('settings.editProfile', 'Edit profile')}</h1>
      </div>

      {/* photo */}
      <div className="card p-6 mb-4 flex flex-col items-center text-center">
        <div className="eyebrow mb-4 self-start">{tr('edit.photo', 'Photo')}</div>
        <span className="p-[2px] rounded-full mb-4" style={{ background: 'var(--holo)' }}>
          {avatar ? (
            <img src={avatar} alt="" className="w-24 h-24 rounded-full object-cover block" />
          ) : (
            <span className="w-24 h-24 rounded-full grid place-items-center font-bold text-3xl bg-[var(--color-paper)] text-[var(--color-ink)]">{initial}</span>
          )}
        </span>
        <input ref={fileRef} type="file" accept="image/*" onChange={pickPhoto} className="hidden" />
        <div className="flex items-center gap-2">
          <button onClick={() => fileRef.current?.click()} disabled={busy} className="btn btn-secondary !py-2">{busy ? tr('edit.reading', 'Reading…') : avatar ? tr('edit.changePhoto', 'Change photo') : tr('edit.uploadPhoto', 'Upload photo')}</button>
          {avatar && !usingXPhoto && (
            <button onClick={() => setAvatar(wallet.baseAvatar || null)} className="btn btn-ghost !py-2 text-sm text-[var(--color-ink-soft)]">{tr('launch.remove', 'Remove')}</button>
          )}
        </div>
      </div>

      {/* name + handle */}
      <div className="card p-6 mb-4">
        <label className="block">
          <span className="eyebrow">{tr('edit.displayName', 'Display name')}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder={tr('edit.namePh', 'Your name')} className="input mt-2" />
        </label>

        <div className="mt-5">
          <span className="eyebrow">{tr('edit.wallet', 'Wallet')}</span>
          <div className="mt-2 flex items-center gap-2 px-3.5 py-2.5 rounded-xl panel-soft">
            <span className="font-mono text-sm text-[var(--color-ink-soft)] flex-1">{handle}</span>
            <span className="inline-flex items-center gap-1 text-xs text-[var(--color-ink-faint)]"><Verified size={12} /> {tr('edit.connected', 'connected')}</span>
          </div>
          <p className="text-[11px] text-[var(--color-ink-faint)] mt-2">{tr('edit.walletHint', 'This is your connected wallet address - your identity on-chain.')}</p>
        </div>
      </div>

      {error && <div className="text-sm text-[var(--color-down)] mb-3">{error}</div>}

      <div className="flex items-center gap-2">
        <button onClick={save} disabled={!dirty || saved} className="btn btn-primary flex-1 justify-center">{saved ? `${tr('edit.saved', 'Saved')} ✓` : tr('edit.save', 'Save changes')}</button>
        {(!usingXName || !usingXPhoto) && (
          <button onClick={resetToX} className="btn btn-secondary">{tr('common.reset', 'Reset')}</button>
        )}
      </div>
    </div>
  )
}
