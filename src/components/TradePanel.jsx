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
    const res = side === 'buy' ? buy(charm.id, amt) : sell(charm.id, amt)
    if (res.ok) {
      setFlash({ ok: true, msg: side === 'buy' ? `Bought ${num(res.units)} ${charm.ticker}` : `Sold for ${usd(res.proceeds)}` })
      setAmount('')
    } else setFlash({ ok: false, msg: res.error })
    setTimeout(() => setFlash(null), 2500)
  }

  return (
    <div className="card p-5 sticky top-24">
      <div className="seg w-full mb-4">
        <button onClick={() => { setSide('buy'); setAmount('') }} className={`flex-1 ${side === 'buy' ? 'on' : ''}`}>Buy</button>
        <button onClick={() => { setSide('sell'); setAmount('') }} className={`flex-1 ${side === 'sell' ? 'on' : ''}`}>Sell</button>
      </div>

      <label className="eyebrow">{side === 'buy' ? 'Amount · USDC' : `Units · ${charm.ticker}`}</label>
      <div className="mt-1.5 mb-3 flex items-center input !py-2.5">
        <span className="text-[var(--color-ink-faint)] mr-1">{side === 'buy' ? '$' : ''}</span>
        <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
          className="w-full bg-transparent outline-none font-mono num text-lg border-0 p-0 focus:ring-0" />
      </div>

      <div className="flex gap-2 mb-4">
        {side === 'buy'
          ? quickBuy.map((v) => <button key={v} onClick={() => setAmount(String(v))} className="btn btn-secondary !py-1.5 !px-0 text-xs flex-1">${v}</button>)
          : [0.25, 0.5, 1].map((f) => <button key={f} onClick={() => setAmount(String(+(units * f).toFixed(4)))} className="btn btn-secondary !py-1.5 text-xs flex-1">{f === 1 ? 'Max' : f * 100 + '%'}</button>)}
      </div>

      {amount > 0 && (
        <div className="text-xs text-[var(--color-ink-soft)] mb-3 space-y-1.5">
          <div className="flex justify-between">
            <span>You receive</span>
            <span className="font-mono num">{side === 'buy' ? `${num(parseFloat(amount) / price)} ${charm.ticker}` : usd(parseFloat(amount) * price)}</span>
          </div>
          <div className="flex justify-between"><span>Price</span><span className="font-mono num">{usd(price)}</span></div>
        </div>
      )}

      <button onClick={submit} className={`btn w-full ${side === 'buy' ? 'btn-primary' : 'btn-secondary'}`}>
        {!wallet ? (<><XGlyph size={13} color="#fff" /> Sign in to trade</>) : side === 'buy' ? `Buy ${charm.ticker}` : `Sell ${charm.ticker}`}
      </button>

      {flash && (
        <div className={`mt-3 text-sm text-center font-medium flash ${flash.ok ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}`}>{flash.msg}</div>
      )}

      <div className="mt-5 pt-4 border-t hairline text-sm space-y-1.5">
        <div className="flex justify-between"><span className="text-[var(--color-ink-soft)]">Your position</span><span className="font-mono num">{num(units)} {charm.ticker}</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-ink-soft)]">Value</span><span className="font-mono num font-semibold">{usd(holdValue)}</span></div>
      </div>
    </div>
  )
}
