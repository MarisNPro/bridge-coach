import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Lightbulb, X, RotateCcw, Flag } from 'lucide-react'
import { SuitGlyph } from '../practice/bridge'
import { playPosition } from '../lib/engine'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const SUITS = ['S', 'H', 'D', 'C']
const PARTNER = { N: 'S', S: 'N', E: 'W', W: 'E' }

function handCards(h) {
  return SUITS.flatMap((s) => [...(h[s] || '')].map((r) => s + r))
}

function StrainLabel({ s }) {
  return s === 'NT' ? <span className="font-semibold">NT</span> : <SuitGlyph s={s} />
}

function PlayHand({ seat, label, cards, isTurn, legal, best, dimmed, onPlay }) {
  return (
    <Card className={cn(isTurn && 'ring-2 ring-primary', dimmed && 'opacity-60')}>
      <CardContent className="space-y-1 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
        {SUITS.map((su) => {
          const inSuit = cards.filter((c) => c[0] === su)
          return (
            <div key={su} className="flex items-center gap-1.5">
              <SuitGlyph s={su} className="w-4 shrink-0 text-center text-lg" />
              <div className="flex flex-wrap gap-1">
                {inSuit.length === 0 && <span className="text-muted-foreground">—</span>}
                {inSuit.map((c) => {
                  const playable = isTurn && legal.has(c)
                  return (
                    <button key={c} type="button" disabled={!playable} onClick={() => onPlay(c)}
                      className={cn('h-9 min-w-7 rounded-md border px-1.5 font-mono text-base tabular-nums transition',
                        playable ? 'cursor-pointer border-border bg-card hover:bg-accent hover:-translate-y-0.5'
                          : 'border-transparent bg-muted/40 text-muted-foreground',
                        best.has(c) && 'border-success bg-success/15 ring-1 ring-success')}>
                      {c[1] === 'T' ? '10' : c[1]}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

export default function InteractivePlay({ board, contract, onExit }) {
  const { t } = useTranslation()
  const [plays, setPlays] = useState([])
  const [eng, setEng] = useState(null)
  const [hint, setHint] = useState(true)
  const [claimed, setClaimed] = useState(false)
  const [error, setError] = useState(null)

  const userSeats = [contract.declarer, PARTNER[contract.declarer]]
  const need = contract.level + 6

  // Fetch the engine state whenever the play history changes.
  useEffect(() => {
    let cancel = false
    setError(null)
    playPosition({ deal: board.pbn, strain: contract.strain, declarer: contract.declarer, played: plays.map((p) => p.card) })
      .then((r) => { if (!cancel) setEng(r) })
      .catch((e) => { if (!cancel) setError(e.message === 'network' ? t('practice.errNetwork') : e.message) })
    return () => { cancel = true }
  }, [plays, board.pbn, contract.strain, contract.declarer, t])

  // Auto-play the best double-dummy card: always for the defenders, and — once
  // the user claims — for every seat, so the hand resolves to its double-dummy
  // result (both sides playing perfectly from here).
  const timer = useRef(null)
  useEffect(() => {
    clearTimeout(timer.current)
    if (!eng || eng.complete) return
    if (!claimed && userSeats.includes(eng.to_act)) return
    const best = eng.legal.reduce((a, b) => (b.dd > a.dd ? b : a), eng.legal[0])
    timer.current = setTimeout(() => setPlays((ps) => [...ps, { seat: eng.to_act, card: best.card }]), claimed ? 250 : 600)
    return () => clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eng, claimed])

  function onPlay(card) {
    if (claimed || !eng || eng.complete || !userSeats.includes(eng.to_act)) return
    if (!eng.legal.some((l) => l.card === card)) return
    setPlays((ps) => [...ps, { seat: eng.to_act, card }])
  }

  // Take back to our last decision: drop our last card and any defender
  // responses to it, so it's our turn again. Only offered on our turn (no
  // pending auto-play), which keeps it race-free.
  function undo() {
    setPlays((ps) => {
      let i = ps.length - 1
      while (i >= 0 && !userSeats.includes(ps[i].seat)) i--
      return i < 0 ? ps : ps.slice(0, i)
    })
  }

  const playedBySeat = { N: new Set(), E: new Set(), S: new Set(), W: new Set() }
  plays.forEach((p) => playedBySeat[p.seat].add(p.card))
  const remaining = (seat) => handCards(board.hands[seat]).filter((c) => !playedBySeat[seat].has(c))

  const legalSet = new Set((eng?.legal || []).map((l) => l.card))
  const bestSet = new Set()
  if (hint && eng && !eng.complete && userSeats.includes(eng.to_act) && eng.legal.length) {
    const top = Math.max(...eng.legal.map((l) => l.dd))
    eng.legal.filter((l) => l.dd === top).forEach((l) => bestSet.add(l.card))
  }

  const made = eng?.declarer_tricks ?? 0
  const makes = eng?.complete && made >= need
  const delta = made - need
  const isUserTurn = eng && !eng.complete && userSeats.includes(eng.to_act)
  const canUndo = isUserTurn && !claimed && plays.some((p) => userSeats.includes(p.seat))
  const canClaim = isUserTurn && !claimed

  // The most recent completed trick (tricks are consecutive groups of 4 plays).
  const completedTricks = Math.floor(plays.length / 4)
  const lastTrick = completedTricks > 0 ? plays.slice((completedTricks - 1) * 4, completedTricks * 4) : null
  const fmtCard = (c) => (c[1] === 'T' ? c[0] + '10' : c)

  const seatCell = (seat) => (
    <PlayHand
      seat={seat}
      label={`${t(`play.seats.${seat}`)}${seat === PARTNER[contract.declarer] ? ` · ${t('play.dummy')}` : ''}`}
      cards={remaining(seat)}
      isTurn={eng?.to_act === seat && !eng?.complete}
      legal={eng?.to_act === seat ? legalSet : new Set()}
      best={eng?.to_act === seat ? bestSet : new Set()}
      dimmed={!userSeats.includes(seat)}
      onPlay={onPlay}
    />
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold inline-flex items-center gap-0.5">
            {contract.level}<StrainLabel s={contract.strain} />
          </span>
          <span className="text-sm text-muted-foreground">{t('play.byShort', { seat: contract.declarer })}</span>
          <Badge variant="secondary">{t('play.tricksLine', { made, need })}</Badge>
          <Badge variant="outline">{t('play.defenders')}: {eng?.defender_tricks ?? 0}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={undo} disabled={!canUndo}>
            <RotateCcw /> {t('play.undo')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setClaimed(true)} disabled={!canClaim}>
            <Flag /> {t('play.claim')}
          </Button>
          <Button variant={hint ? 'secondary' : 'ghost'} size="sm" onClick={() => setHint((h) => !h)}>
            <Lightbulb /> {t('play.hint')}
          </Button>
          <Button variant="ghost" size="sm" onClick={onExit}><X /> {t('play.exit')}</Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{t('practice.error')}: {error}</p>}

      {/* Compass play table */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="md:col-start-2 md:row-start-1">{seatCell('N')}</div>
        <div className="md:col-start-1 md:row-start-2">{seatCell('W')}</div>
        <div className="grid place-items-center md:col-start-2 md:row-start-2">
          <div className="min-h-24 w-full rounded-xl border border-dashed border-border p-3 text-center">
            {eng?.complete ? (
              <div className="space-y-1">
                <div className={cn('text-lg font-bold', makes ? 'text-success' : 'text-destructive')}>
                  {makes ? t('play.makesBy', { n: delta === 0 ? '=' : `+${delta}` }) : t('play.downBy', { n: -delta })}
                </div>
                <div className="text-xs text-muted-foreground">{t('play.tricks', { n: made })}</div>
                {claimed && <div className="text-xs text-muted-foreground">{t('play.claimed')}</div>}
              </div>
            ) : (
              <>
                <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                  {claimed ? t('play.claiming') : isUserTurn ? t('play.yourTurn') : t('play.thinking')}
                </div>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {(eng?.trick || []).map((tc, i) => (
                    <span key={i} className="rounded-md border border-border bg-card px-2 py-1 font-mono text-sm">
                      {tc.seat}:{tc.card[1] === 'T' ? tc.card[0] + '10' : tc.card}
                    </span>
                  ))}
                </div>
              </>
            )}
            {lastTrick && (
              <div className="mt-3 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                {t('play.lastTrick')}: {lastTrick.map((tc) => `${tc.seat} ${fmtCard(tc.card)}`).join('   ')}
              </div>
            )}
          </div>
        </div>
        <div className="md:col-start-3 md:row-start-2">{seatCell('E')}</div>
        <div className="md:col-start-2 md:row-start-3">{seatCell('S')}</div>
      </div>
    </div>
  )
}
