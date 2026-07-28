import { useState } from 'react'
import { useStore } from '../lib/store'
import { usd, num } from '../lib/format'
import { XGlyph } from './icons'

export default function TradePanel({ charm }) {
  const { wallet, connect, holdings, prices, buy, sell } = useStore()
  const [side, setSide] = useState('buy')
  const [amount, setAmount] = useState('')
  const [flash, setFlash] = useState(null)

  const price = prices[charm.id] ?? charm.price
  const holding = holdings[charm.id]
  const units = holding?.units ?? 0
  const holdValue = units * price

  const quickBuy = [10, 25, 100, 250]

  function submit() {
    if (!wallet) return connect()
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) return
    let res
    if (side === 'buy') res = buy(charm.id, amt)
    else res = sell(charm.id, amt)
    if (res.ok) {
      setFlash({ ok: true, msg: side === 'buy' ? `Bought ${num(res.units)} ${charm.ticker}` : `Sold for ${usd(res.proceeds)}` })
      setAmount('')
    } else {
      setFlash({ ok: false, msg: res.error })
    }
    setTimeout(() => setFlash(null), 2500)
  }

  return (
    <div className="card card-glow p-5 sticky top-20">
      <div className="flex gap-1 p-1 rounded-full bg-white/5 border border-white/10 mb-4">
        <button onClick={() => { setSide('buy'); setAmount('') }} className={`flex-1 py-2 rounded-full text-sm font-semibold transition ${side === 'buy' ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent-hi)]' : 'text-[var(--color-ink-soft)]'}`}>Buy</button>
        <button onClick={() => { setSide('sell'); setAmount('') }} className={`flex-1 py-2 rounded-full text-sm font-semibold transition ${side === 'sell' ? 'bg-[rgba(255,93,108,.12)] text-[var(--color-down)]' : 'text-[var(--color-ink-soft)]'}`}>Sell</button>
      </div>

      <label className="eyebrow">
        {side === 'buy' ? 'Amount / USDC' : `Units / ${charm.ticker}`}
      </label>
      <div className="mt-1.5 mb-3 flex items-center rounded-xl px-3 py-2.5 bg-white/4 border border-white/12">
        <span className="text-[var(--color-ink-soft)] mr-1">{side === 'buy' ? '$' : ''}</span>
        <input
          type="number" min="0" value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-full bg-transparent outline-none font-mono text-lg"
        />
      </div>

      <div className="flex gap-2 mb-4">
        {side === 'buy'
          ? quickBuy.map((v) => (
              <button key={v} onClick={() => setAmount(String(v))} className="btn btn-ghost !py-1.5 !px-3 text-xs flex-1">${v}</button>
            ))
          : [0.25, 0.5, 1].map((f) => (
              <button key={f} onClick={() => setAmount(String(+(units * f).toFixed(4)))} className="btn btn-ghost !py-1.5 !px-3 text-xs flex-1">
                {f === 1 ? 'Max' : f * 100 + '%'}
              </button>
            ))}
      </div>

      {amount > 0 && (
        <div className="text-xs text-[var(--color-ink-soft)] mb-3 space-y-1">
          {side === 'buy' ? (
            <div className="flex justify-between"><span>You receive</span><span className="font-mono">{num(parseFloat(amount) / price)} {charm.ticker}</span></div>
          ) : (
            <div className="flex justify-between"><span>You receive</span><span className="font-mono">{usd(parseFloat(amount) * price)}</span></div>
          )}
          <div className="flex justify-between"><span>Price</span><span className="font-mono">{usd(price)}</span></div>
        </div>
      )}

      <button onClick={submit} className={`btn w-full ${side === 'buy' ? 'btn-primary' : 'btn-ghost'}`}>
        {!wallet ? (<><XGlyph size={13} /> Log in to trade</>) : side === 'buy' ? `Buy ${charm.ticker}` : `Sell ${charm.ticker}`}
      </button>

      {flash && (
        <div className={`mt-3 text-sm text-center font-semibold flash ${flash.ok ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}`}>
          {flash.msg}
        </div>
      )}

      <div className="mt-5 pt-4 border-t hairline text-sm">
        <div className="flex justify-between mb-1"><span className="text-[var(--color-ink-soft)]">Your position</span><span className="font-mono">{num(units)} {charm.ticker}</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-ink-soft)]">Value</span><span className="font-mono font-semibold">{usd(holdValue)}</span></div>
      </div>
    </div>
  )
}
