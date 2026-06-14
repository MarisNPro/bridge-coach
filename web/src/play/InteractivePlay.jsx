import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Lightbulb, X, RotateCcw, Flag, Eye, EyeOff, Users } from 'lucide-react'
import { SuitGlyph } from '../practice/bridge'
import { playPosition, playBot } from '../lib/engine'
import { trickWinner, projectedDeclarerTricks } from './deal'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const SUITS = ['S', 'H', 'D', 'C']
const PARTNER = { N: 'S', S: 'N', E: 'W', W: 'E' }
const LHO = { N: 'E', E: 'S', S: 'W', W: 'N' }   // left-hand opponent (clockwise)

function handCards(h) {
  return SUITS.flatMap((s) => [...(h[s] || '')].map((r) => s + r))
}

function StrainLabel({ s }) {
  return s === 'NT' ? <span className="font-semibold">NT</span> : <SuitGlyph s={s} />
}

function PlayHand({ seat, label, cards, isTurn, legal, best, dimmed, faceDown, onPlay }) {
  return (
    <Card className={cn(isTurn && 'ring-2 ring-primary', dimmed && 'opacity-60')}>
      <CardContent className="space-y-1 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}{faceDown && cards.length ? ` · ${cards.length}` : ''}
        </div>
        {faceDown ? (
          <div className="flex flex-wrap gap-1 pt-1">
            {cards.length === 0
              ? <span className="text-muted-foreground">—</span>
              : Array.from({ length: cards.length }).map((_, i) => (
                <div key={i} className="h-9 w-6 rounded-md border border-border bg-muted/70" />
              ))}
          </div>
        ) : (
        SUITS.map((su) => {
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
        }))}
      </CardContent>
    </Card>
  )
}

// One card in the trick, placed at its seat around the centre. The card-in
// animation replays whenever the card changes (keyed by the caller).
function TrickCardFace({ seat, card, winner }) {
  const rank = card[1] === 'T' ? '10' : card[1]
  return (
    <div className={cn('animate-card-in inline-flex flex-col items-center rounded-md border bg-card px-2 py-1 shadow-sm',
      winner ? 'border-success ring-2 ring-success' : 'border-border')}>
      <span className="text-[10px] leading-none text-muted-foreground">{seat}</span>
      <span className="inline-flex items-center gap-0.5 font-mono text-sm leading-tight"><SuitGlyph s={card[0]} />{rank}</span>
    </div>
  )
}

export default function InteractivePlay({ board, contract, onExit, constraints = null, userSeat = null }) {
  const { t } = useTranslation()
  const [plays, setPlays] = useState([])
  const [eng, setEng] = useState(null)
  const [hint, setHint] = useState(true)
  const [claimed, setClaimed] = useState(false)
  const [hidden, setHidden] = useState(true)   // hidden-hand mode: opponents face-down
  const [defend, setDefend] = useState(false)  // play as a defender vs a bot declarer
  const [error, setError] = useState(null)

  const dummySeat = PARTNER[contract.declarer]
  const leader = LHO[contract.declarer]        // opening leader = declarer's LHO
  // Declare: you play declarer + dummy. Defend: you play the opening leader; the
  // bot plays the whole declaring side and your partner. When `userSeat` is fixed
  // (from the bidding phase), the auction decides: you declare if your side won
  // the contract, otherwise you defend as that seat.
  const onDeclaringSide = userSeat && (userSeat === contract.declarer || userSeat === dummySeat)
  const userSeats = userSeat
    ? (onDeclaringSide ? [contract.declarer, dummySeat] : [userSeat])
    : (defend ? [leader] : [contract.declarer, dummySeat])
  const need = contract.level + 6
  const dottedHand = (h) => `${h.S || ''}.${h.H || ''}.${h.D || ''}.${h.C || ''}`

  function switchMode() { setDefend((d) => !d); setPlays([]); setClaimed(false) }

  // What a bot may see when it's its turn. The declaring side (declarer + dummy)
  // sees both of its hands; a defender sees only its own hand + dummy once the
  // opening lead is down. The concealed hands are never included.
  function botKnownHands(seat) {
    const known = {}
    const openingLed = plays.length >= 1
    if (seat === contract.declarer || seat === dummySeat) {
      known[contract.declarer] = dottedHand(board.hands[contract.declarer])
      known[dummySeat] = dottedHand(board.hands[dummySeat])
    } else {
      known[seat] = dottedHand(board.hands[seat])
      if (openingLed) known[dummySeat] = dottedHand(board.hands[dummySeat])
    }
    return known
  }

  // Fetch the engine state whenever the play history changes.
  useEffect(() => {
    let cancel = false
    setError(null)
    playPosition({ deal: board.pbn, strain: contract.strain, declarer: contract.declarer, played: plays.map((p) => p.card) })
      .then((r) => { if (!cancel) setEng(r) })
      .catch((e) => { if (!cancel) setError(e.message === 'network' ? t('practice.errNetwork') : e.message) })
    return () => { cancel = true }
  }, [plays, board.pbn, contract.strain, contract.declarer, t])

  // Drive the seats the user doesn't control. On a claim, resolve the whole hand
  // double-dummy (best card for every seat). Otherwise an opponent's turn is
  // played by the non-cheating bot (/bot), which sees only its hand + dummy.
  const timer = useRef(null)
  useEffect(() => {
    clearTimeout(timer.current)
    if (!eng || eng.complete) return
    if (!claimed && userSeats.includes(eng.to_act)) return
    const seat = eng.to_act
    const bestDD = () => eng.legal.reduce((a, b) => (b.dd > a.dd ? b : a), eng.legal[0]).card

    if (claimed) {
      timer.current = setTimeout(() => setPlays((ps) => [...ps, { seat, card: bestDD() }]), 250)
      return () => clearTimeout(timer.current)
    }

    let cancelled = false
    timer.current = setTimeout(() => {
      playBot({
        known_hands: botKnownHands(seat), played: plays.map((p) => p.card),
        strain: contract.strain, declarer: contract.declarer, samples: 16, constraints,
      })
        .then((r) => { if (!cancelled) setPlays((ps) => [...ps, { seat, card: r.card }]) })
        .catch(() => { if (!cancelled) setPlays((ps) => [...ps, { seat, card: bestDD() }]) }) // fall back to DD
    }, 450)
    return () => { cancelled = true; clearTimeout(timer.current) }
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
  // Live double-dummy projection of the final result from the current position.
  const projected = projectedDeclarerTricks(eng, userSeats)
  const projDelta = projected - need
  const isUserTurn = eng && !eng.complete && userSeats.includes(eng.to_act)
  const canUndo = isUserTurn && !claimed && plays.some((p) => userSeats.includes(p.seat))
  const canClaim = isUserTurn && !claimed && !defend   // claiming is a declarer action

  // The most recent completed trick (tricks are consecutive groups of 4 plays).
  const completedTricks = Math.floor(plays.length / 4)
  const lastTrick = completedTricks > 0 ? plays.slice((completedTricks - 1) * 4, completedTricks * 4) : null
  const fmtCard = (c) => (c[1] === 'T' ? c[0] + '10' : c)

  // Trick shown in the centre: the in-progress trick (1-3 cards), or — once the
  // 4th card lands — the just-completed trick held with its winner highlighted,
  // until the next card leads the following trick.
  const building = plays.slice(completedTricks * 4)
  const justCompleted = building.length === 0 && completedTricks > 0
    ? plays.slice((completedTricks - 1) * 4, completedTricks * 4) : null
  const shownTrick = building.length > 0 ? building : (justCompleted || [])
  const winnerSeat = shownTrick.length === 4 ? trickWinner(shownTrick, contract.strain) : null
  const trickBySeat = {}
  shownTrick.forEach((p) => { trickBySeat[p.seat] = p.card })

  // Hidden-hand view: you see the seats you control always, dummy once the
  // opening lead is made, and everything at the end for review; the rest are
  // face-down.
  const revealAll = !hidden || eng?.complete
  const isVisible = (seat) =>
    revealAll || userSeats.includes(seat) || (seat === dummySeat && plays.length >= 1)

  const seatCell = (seat) => (
    <PlayHand
      seat={seat}
      label={`${t(`play.seats.${seat}`)}${seat === dummySeat ? ` · ${t('play.dummy')}` : ''}`}
      cards={remaining(seat)}
      isTurn={eng?.to_act === seat && !eng?.complete}
      legal={eng?.to_act === seat ? legalSet : new Set()}
      best={eng?.to_act === seat ? bestSet : new Set()}
      dimmed={!userSeats.includes(seat)}
      faceDown={!isVisible(seat)}
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
          {eng && !eng.complete && (
            <Badge variant="outline"
              className={cn(projDelta >= 0 ? 'border-success/40 text-success' : 'border-destructive/40 text-destructive')}>
              {t('play.projected')}: {projDelta >= 0 ? t('play.makesBy', { n: projDelta === 0 ? '=' : `+${projDelta}` }) : t('play.downBy', { n: -projDelta })}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={undo} disabled={!canUndo}>
            <RotateCcw /> {t('play.undo')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setClaimed(true)} disabled={!canClaim}>
            <Flag /> {t('play.claim')}
          </Button>
          {!userSeat && (
            <Button variant="ghost" size="sm" onClick={switchMode}>
              <Users /> {defend ? t('play.declareMode') : t('play.defendMode')}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setHidden((h) => !h)}>
            {hidden ? <Eye /> : <EyeOff />} {hidden ? t('play.reveal') : t('play.hide')}
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
                <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                  {claimed ? t('play.claiming') : isUserTurn ? t('play.yourTurn') : t('play.thinking')}
                </div>
                <div className="mx-auto grid w-fit grid-cols-3 grid-rows-3 gap-1">
                  <div className="col-start-2 row-start-1">
                    {trickBySeat.N && <TrickCardFace key={trickBySeat.N} seat="N" card={trickBySeat.N} winner={winnerSeat === 'N'} />}
                  </div>
                  <div className="col-start-1 row-start-2 self-center">
                    {trickBySeat.W && <TrickCardFace key={trickBySeat.W} seat="W" card={trickBySeat.W} winner={winnerSeat === 'W'} />}
                  </div>
                  <div className="col-start-3 row-start-2 self-center">
                    {trickBySeat.E && <TrickCardFace key={trickBySeat.E} seat="E" card={trickBySeat.E} winner={winnerSeat === 'E'} />}
                  </div>
                  <div className="col-start-2 row-start-3">
                    {trickBySeat.S && <TrickCardFace key={trickBySeat.S} seat="S" card={trickBySeat.S} winner={winnerSeat === 'S'} />}
                  </div>
                </div>
              </>
            )}
            {(eng?.complete || building.length > 0) && lastTrick && (
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
