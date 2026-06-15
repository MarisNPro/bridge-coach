// The mobile-first card-play table: you-at-the-bottom, dummy/partner across the
// top, opponents as edge card-backs, a central trick well, and a compact action
// bar. Pure presentation — every piece of state arrives via props (PR-3 wires it
// to the play engine). Seat geometry comes from `relativeSeats(bottomSeat)`.
//
// Props (see PlayReview/InteractivePlay for the source values):
//   contract    {level, strain, declarer}
//   bottomSeat  seat anchored at the bottom (the seat you play; declarer when
//               declaring, your seat when defending)
//   seatInfo    (seat) => { cards:string[], faceDown:bool, isTurn:bool,
//                           interactive:bool, legal:Set, best:Set, isDummy:bool }
//   onPlay      (card) => void
//   trick       { [seat]: card }  cards in the shown trick
//   winnerSeat  seat | null
//   phase       'user' | 'auto' | 'claiming' | 'complete'
//   status      { made, need, defenderTricks, projDelta|null }
//   result      { makes, delta, claimed } | null   (when complete)
//   flags       { canUndo, canClaim, hidden, hint, defend, showModeToggle }
//   actions     { onUndo, onClaim, onToggleReveal, onToggleHint, onToggleMode, onExit }
import { useTranslation } from 'react-i18next'
import { Lightbulb, RotateCcw, Flag, Eye, EyeOff, Users, X, MoreHorizontal } from 'lucide-react'
import { SuitGlyph } from '@/practice/bridge'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose,
} from '@/components/ui/dialog'
import Fan from './cards/Fan'
import PlayingCard from './cards/PlayingCard'
import CardBack from './cards/CardBack'
import { relativeSeats } from './seating'

const SUITS = ['S', 'H', 'D', 'C']
const EMPTY = new Set()

function StrainLabel({ s }) {
  return s === 'NT' ? <span className="font-semibold">NT</span> : <SuitGlyph s={s} />
}

// A top/bottom hand: a face-up fan you can tap on your turn, a face-up but inert
// fan when it's visible but not yours, or face-down backs.
function HandRow({ label, tag, info, onPlay }) {
  return (
    <div className="w-full">
      <div className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}{tag ? ` · ${tag}` : ''}{info.faceDown && info.cards.length ? ` · ${info.cards.length}` : ''}
      </div>
      <Fan
        cards={info.cards}
        faceDown={info.faceDown}
        legal={info.interactive ? info.legal : EMPTY}
        best={info.interactive ? info.best : EMPTY}
        onPlay={info.interactive ? onPlay : undefined}
        disabled={!info.interactive}
      />
    </div>
  )
}

// An opponent on the left/right edge: a back with its remaining count while
// concealed, or a compact vertical suit list once revealed / at the end.
function SideSeat({ label, info, t }) {
  return (
    <div className="flex w-16 flex-col items-center gap-1">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      {info.faceDown ? (
        <div className="relative" role="img"
          aria-label={t('play.concealedHand', { seat: label, n: info.cards.length })}>
          <CardBack className="h-14 w-10" />
          <span aria-hidden="true"
            className="absolute inset-0 grid place-items-center font-mono text-sm font-bold text-primary-foreground">
            {info.cards.length}
          </span>
        </div>
      ) : (
        <div className="space-y-0.5">
          {SUITS.map((su) => {
            const ranks = info.cards.filter((c) => c[0] === su).map((c) => (c[1] === 'T' ? '10' : c[1]))
            return (
              <div key={su} className="flex items-center gap-1 leading-none">
                <SuitGlyph s={su} className="text-sm" />
                <span className="font-mono text-xs tabular-nums">{ranks.length ? ranks.join(' ') : '—'}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// The four played cards arranged toward the seat that played them, relative to
// you (your card at the bottom). The winning card is ringed.
function TrickWell({ rel, trick, winnerSeat, phase, status, result, t }) {
  const slot = (pos) => {
    const seat = rel[pos]
    const card = trick[seat]
    if (!card) return null
    const won = winnerSeat === seat
    return (
      <PlayingCard
        key={card}
        card={card}
        className={cn('animate-card-in h-12 w-9 sm:h-14 sm:w-10',
          won && 'animate-winner border-success ring-2 ring-success')}
      />
    )
  }

  const label = result
    ? (result.makes
      ? t('play.makesBy', { n: result.delta === 0 ? '=' : `+${result.delta}` })
      : t('play.downBy', { n: -result.delta }))
    : phase === 'claiming' ? t('play.claiming')
      : phase === 'user' ? t('play.yourTurn')
        : t('play.thinking')

  return (
    <div className="grid w-full max-w-64 place-items-center">
      <div aria-live="polite" aria-atomic="true"
        className={cn('mb-1 text-xs font-medium uppercase tracking-wide',
          result ? (result.makes ? 'text-success' : 'text-destructive') : 'text-muted-foreground')}>
        {label}{result?.claimed ? ` · ${t('play.claimed')}` : ''}
      </div>
      <div className="grid grid-cols-3 grid-rows-3 gap-1">
        <div className="col-start-2 row-start-1">{slot('top')}</div>
        <div className="col-start-1 row-start-2 self-center">{slot('left')}</div>
        <div className="col-start-3 row-start-2 self-center">{slot('right')}</div>
        <div className="col-start-2 row-start-3">{slot('bottom')}</div>
      </div>
      {result && <div className="mt-1 text-xs text-muted-foreground">{t('play.tricks', { n: status.made })}</div>}
    </div>
  )
}

export default function MobileTable({
  contract, bottomSeat, seatInfo, onPlay, trick = {}, winnerSeat = null,
  phase = 'user', status, result = null, flags, actions,
}) {
  const { t } = useTranslation()
  const rel = relativeSeats(bottomSeat)
  const seatName = (s) => t(`play.seats.${s}`)
  const topInfo = seatInfo(rel.top)
  const bottomInfo = seatInfo(rel.bottom)

  const projDelta = status.projDelta
  const showProj = !result && projDelta != null

  return (
    <div className="flex flex-col gap-3">
      {/* Status bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-0.5 text-lg font-bold">
            {contract.level}<StrainLabel s={contract.strain} />
          </span>
          <span className="text-xs text-muted-foreground">{t('play.byShort', { seat: contract.declarer })}</span>
          <Badge variant="secondary">{t('play.tricksLine', { made: status.made, need: status.need })}</Badge>
          <Badge variant="outline">{t('play.defenders')}: {status.defenderTricks}</Badge>
          {showProj && (
            <Badge variant="outline"
              className={cn(projDelta >= 0 ? 'border-success/40 text-success' : 'border-destructive/40 text-destructive')}>
              {t('play.projected')}: {projDelta >= 0 ? t('play.makesBy', { n: projDelta === 0 ? '=' : `+${projDelta}` }) : t('play.downBy', { n: -projDelta })}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" aria-label={t('play.exit')} onClick={actions.onExit}><X /></Button>
      </div>

      {/* Table: top hand, then sides flanking the trick well, then your hand */}
      <HandRow
        label={seatName(rel.top)}
        tag={topInfo.isDummy ? t('play.dummy') : null}
        info={topInfo}
        onPlay={onPlay}
      />

      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-1">
        <SideSeat label={seatName(rel.left)} info={seatInfo(rel.left)} t={t} />
        <div className="grid place-items-center">
          <TrickWell rel={rel} trick={trick} winnerSeat={winnerSeat}
            phase={phase} status={status} result={result} t={t} />
        </div>
        <SideSeat label={seatName(rel.right)} info={seatInfo(rel.right)} t={t} />
      </div>

      <HandRow
        label={`${seatName(rel.bottom)} · ${t('play.you')}`}
        info={bottomInfo}
        onPlay={onPlay}
      />

      {/* Action bar: primary actions inline, the rest behind "More". Buttons are
          sized to a comfortable touch target (h-11 = 44px). */}
      <div className="flex items-center justify-center gap-2">
        <Button variant="ghost" size="sm" className="h-11 flex-1" onClick={actions.onUndo} disabled={!flags.canUndo}>
          <RotateCcw /> {t('play.undo')}
        </Button>
        <Button variant={flags.hint ? 'secondary' : 'ghost'} size="sm" className="h-11 flex-1" onClick={actions.onToggleHint}>
          <Lightbulb /> {t('play.hint')}
        </Button>
        <Button variant="ghost" size="sm" className="h-11 flex-1" onClick={actions.onClaim} disabled={!flags.canClaim}>
          <Flag /> {t('play.claim')}
        </Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-11 flex-1"><MoreHorizontal /> {t('play.more')}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('play.more')}</DialogTitle>
              <DialogDescription className="sr-only">{t('play.moreDesc')}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <DialogClose asChild>
                <Button variant="outline" onClick={actions.onToggleReveal} className="h-11 justify-start">
                  {flags.hidden ? <Eye /> : <EyeOff />} {flags.hidden ? t('play.reveal') : t('play.hide')}
                </Button>
              </DialogClose>
              {flags.showModeToggle && (
                <DialogClose asChild>
                  <Button variant="outline" onClick={actions.onToggleMode} className="h-11 justify-start">
                    <Users /> {flags.defend ? t('play.declareMode') : t('play.defendMode')}
                  </Button>
                </DialogClose>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
