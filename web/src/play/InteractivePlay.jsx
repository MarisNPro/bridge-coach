import { useTranslation } from 'react-i18next'
import { Lightbulb, X, RotateCcw, Flag, Eye, EyeOff, Users } from 'lucide-react'
import { SuitGlyph } from '../practice/bridge'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { usePlay } from './usePlay'
import MobileTable from './MobileTable'

const SUITS = ['S', 'H', 'D', 'C']
const EMPTY = new Set()

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
      winner ? 'animate-winner border-success ring-2 ring-success' : 'border-border')}>
      <span className="text-[10px] leading-none text-muted-foreground">{seat}</span>
      <span className="inline-flex items-center gap-0.5 font-mono text-sm leading-tight"><SuitGlyph s={card[0]} />{rank}</span>
    </div>
  )
}

// The wide (tablet/desktop) layout: the familiar 4-around compass table.
function CompassLayout({ play, contract, userSeat, onExit }) {
  const { t } = useTranslation()
  const {
    eng, error, made, need, complete, makes, delta, projDelta, isUserTurn, defenderTricks,
    claimed, hint, hidden, defend, dummySeat, userSeats, remaining, isVisible, legalSet, bestSet,
    trickBySeat, winnerSeat, lastTrick, building, undo, claim, switchMode, toggleHint, toggleReveal,
    canUndo, canClaim, showModeToggle,
  } = play
  const fmtCard = (c) => (c[1] === 'T' ? c[0] + '10' : c)

  const seatCell = (seat) => (
    <PlayHand
      seat={seat}
      label={`${t(`play.seats.${seat}`)}${seat === dummySeat ? ` · ${t('play.dummy')}` : ''}`}
      cards={remaining(seat)}
      isTurn={eng?.to_act === seat && !eng?.complete}
      legal={eng?.to_act === seat ? legalSet : EMPTY}
      best={eng?.to_act === seat ? bestSet : EMPTY}
      dimmed={!userSeats.includes(seat)}
      faceDown={!isVisible(seat)}
      onPlay={play.onPlay}
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
          <Badge variant="outline">{t('play.defenders')}: {defenderTricks}</Badge>
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
          <Button variant="ghost" size="sm" onClick={claim} disabled={!canClaim}>
            <Flag /> {t('play.claim')}
          </Button>
          {showModeToggle && (
            <Button variant="ghost" size="sm" onClick={switchMode}>
              <Users /> {defend ? t('play.declareMode') : t('play.defendMode')}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={toggleReveal}>
            {hidden ? <Eye /> : <EyeOff />} {hidden ? t('play.reveal') : t('play.hide')}
          </Button>
          <Button variant={hint ? 'secondary' : 'ghost'} size="sm" onClick={toggleHint}>
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
          <div aria-live="polite" className="min-h-24 w-full rounded-xl border border-dashed border-border p-3 text-center">
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

// The mobile (phone) layout: the "you-at-the-bottom" table. Maps the shared play
// state into MobileTable's presentational contract.
function MobileLayout({ play, contract, onExit }) {
  const { t } = useTranslation()
  const { eng } = play
  const bottomSeat = play.userSeats[0]

  const seatInfo = (seat) => {
    const isTurn = eng?.to_act === seat && !play.complete
    const interactive = isTurn && play.userSeats.includes(seat) && !play.claimed
    return {
      cards: play.remaining(seat),
      faceDown: !play.isVisible(seat),
      isTurn,
      interactive,
      legal: eng?.to_act === seat ? play.legalSet : EMPTY,
      best: eng?.to_act === seat ? play.bestSet : EMPTY,
      isDummy: seat === play.dummySeat,
    }
  }

  const phase = play.complete ? 'complete'
    : play.claimed ? 'claiming'
      : play.isUserTurn ? 'user' : 'auto'

  return (
    <div className="space-y-3">
      {play.error && <p className="text-sm text-destructive">{t('practice.error')}: {play.error}</p>}
      <MobileTable
        contract={contract}
        bottomSeat={bottomSeat}
        seatInfo={seatInfo}
        onPlay={play.onPlay}
        trick={play.trickBySeat}
        winnerSeat={play.winnerSeat}
        phase={phase}
        status={{
          made: play.made, need: play.need, defenderTricks: play.defenderTricks,
          projDelta: eng && !play.complete ? play.projDelta : null,
        }}
        result={play.complete ? { makes: play.makes, delta: play.delta, claimed: play.claimed } : null}
        flags={{
          canUndo: play.canUndo, canClaim: play.canClaim, hidden: play.hidden,
          hint: play.hint, defend: play.defend, showModeToggle: play.showModeToggle,
        }}
        actions={{
          onUndo: play.undo, onClaim: play.claim, onToggleReveal: play.toggleReveal,
          onToggleHint: play.toggleHint, onToggleMode: play.switchMode, onExit,
        }}
      />
    </div>
  )
}

export default function InteractivePlay({ board, contract, onExit, constraints = null, userSeat = null }) {
  const play = usePlay({ board, contract, constraints, userSeat })
  const isMobile = useMediaQuery('(max-width: 767px)')

  return isMobile
    ? <MobileLayout play={play} contract={contract} onExit={onExit} />
    : <CompassLayout play={play} contract={contract} userSeat={userSeat} onExit={onExit} />
}
