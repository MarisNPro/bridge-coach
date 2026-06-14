import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { Hand, Call } from '../practice/bridge'
import BiddingBox from '../practice/BiddingBox'
import { getBid, explainCall } from '../lib/engine'
import {
  seatAt, auctionComplete, contractFromAuction, accumulateConstraints, botCall, normalizeCall,
  toEngineAuction, roleOf,
} from './auction'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const SEATS = ['N', 'E', 'S', 'W']
const STRAIN_RANK = { C: 0, D: 1, H: 2, S: 3, NT: 4 }
const bidRank = (c) => (/^[1-7](C|D|H|S|NT)$/.test(c) ? +c[0] * 5 + STRAIN_RANK[c.slice(1)] : -1)
const lastBidRank = (calls) => calls.reduce((r, c) => Math.max(r, bidRank(normalizeCall(c))), -1)

// Keep it simple: a user bid must outrank the last bid; Pass/X/XX are allowed
// (the engine grades regardless, and the contract is adjustable afterwards).
function userCallLegal(call, calls) {
  const c = normalizeCall(call)
  if (c === 'Pass' || c === 'X' || c === 'XX') return true
  return bidRank(c) > lastBidRank(calls)
}

const dottedHand = (h) => `${h.S || ''}.${h.H || ''}.${h.D || ''}.${h.C || ''}`

// The bidding phase: you bid `userSeat` (default South) while the bot bids the
// other three via /bid. On completion it reports the derived contract + the
// per-seat constraints accumulated from the bots' promised ranges.
export default function Bidding({ board, dealer = 'S', userSeat = 'S', onComplete, onCancel }) {
  const { t } = useTranslation()
  const [entries, setEntries] = useState([])   // { seat, call, promised }
  const [thinking, setThinking] = useState(false)
  const [explain, setExplain] = useState(null) // { label, call, meaning|text, variants }
  const fired = useRef(false)

  const calls = entries.map((e) => e.call)
  const turn = seatAt(dealer, entries.length)
  const done = auctionComplete(calls)

  // Bots auto-call; on completion report the contract + constraints (once).
  useEffect(() => {
    if (done) {
      if (fired.current) return
      fired.current = true
      onComplete({ contract: contractFromAuction(calls, dealer), constraints: accumulateConstraints(entries) })
      return
    }
    if (turn === userSeat) return               // wait for the human
    let cancel = false
    setThinking(true)
    const id = setTimeout(() => {
      botCall(getBid, { hands: board.hands, dealer, calls })
        .then((r) => { if (!cancel) { setThinking(false); setEntries((e) => [...e, r]) } })
        .catch(() => { if (!cancel) { setThinking(false); setEntries((e) => [...e, { seat: turn, call: 'Pass', promised: null }]) } })
    }, 500)
    return () => { cancel = true; clearTimeout(id); setThinking(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, done])

  function userBid(call) {
    if (turn !== userSeat || done || !userCallLegal(call, calls)) return
    setEntries((e) => [...e, { seat: userSeat, call: normalizeCall(call), promised: null }])
  }

  // Explain any call: frame the auction up to (not including) it from the
  // caller's seat and ask /explain. Uncovered nodes -> "no explanation".
  function onExplain(i) {
    const e = entries[i]
    const before = entries.slice(0, i).map((x) => x.call)
    const label = t(`play.seats.${e.seat}`)
    setExplain({ label, call: e.call, loading: true })
    explainCall({ auction: toEngineAuction(before, dealer, e.seat), call: e.call, seat: roleOf(before, dealer, e.seat), system_id: 'natural-v1' })
      .then((r) => setExplain({ label, call: e.call, meaning: r.meaning, text: r.text, variants: r.variants || [] }))
      .catch(() => setExplain({ label, call: e.call, text: t('play.noExplain') }))
  }

  // Lay the calls out under their seat column, wrapping every four.
  const off = SEATS.indexOf(dealer)
  const rows = []
  entries.forEach((e, i) => {
    const row = Math.floor((i + off) / 4)
    ;(rows[row] = rows[row] || [null, null, null, null])[SEATS.indexOf(e.seat)] = { e, i }
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">{t('play.bidTitle')}</h2>
        <Button variant="ghost" size="sm" onClick={onCancel}><X /> {t('play.cancel')}</Button>
      </div>

      {/* Auction grid */}
      <Card>
        <CardContent className="p-3">
          <table className="w-full table-fixed text-center text-sm">
            <thead>
              <tr>{SEATS.map((s) => (
                <th key={s} className={cn('py-1 text-xs font-semibold uppercase text-muted-foreground',
                  turn === s && !done && 'text-primary')}>{t(`play.seats.${s}`)}</th>
              ))}</tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={4} className="py-2 text-muted-foreground">—</td></tr>}
              {rows.map((r, ri) => (
                <tr key={ri}>{SEATS.map((s, ci) => (
                  <td key={s} className="py-1">
                    {r[ci] ? (
                      <button type="button" onClick={() => onExplain(r[ci].i)}
                        className="rounded px-1.5 py-0.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <Call value={r[ci].e.call} />
                      </button>
                    ) : ''}
                  </td>
                ))}</tr>
              ))}
            </tbody>
          </table>
          {entries.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{t('play.tapExplain')}</p>}
        </CardContent>
      </Card>

      {explain && (
        <Card>
          <CardContent className="space-y-1 p-3 text-sm">
            <div className="font-medium">{explain.label} <Call value={explain.call} /></div>
            {explain.loading ? (
              <p className="text-muted-foreground">…</p>
            ) : explain.variants && explain.variants.length > 1 ? (
              <ul className="list-disc pl-5 text-foreground/80">
                {explain.variants.map((v, i) => <li key={i}>{v.meaning}</li>)}
              </ul>
            ) : (
              <p className="text-foreground/80">{explain.meaning || explain.text}</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="text-sm text-muted-foreground">
        {t('play.yourHand')} <span className="font-medium text-foreground">({t(`play.seats.${userSeat}`)})</span>
      </div>
      <Hand hand={dottedHand(board.hands[userSeat])} />

      <div className="min-h-12">
        {done ? (
          <p className="text-sm text-muted-foreground">{t('play.auctionDone')}</p>
        ) : turn === userSeat ? (
          <BiddingBox value={null} onSelect={userBid} />
        ) : (
          <p className="text-sm text-muted-foreground">{thinking ? t('play.botThinking', { seat: t(`play.seats.${turn}`) }) : '…'}</p>
        )}
      </div>
    </div>
  )
}
