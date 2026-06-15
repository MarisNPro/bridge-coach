// A single playing-card face for the play surface. Two visual styles, chosen by
// the `cardStyle` setting (overridable via the `variant` prop for previews):
//   - 'minimalist'  : one corner index + a large centre suit glyph (clean, the
//                     enlarged descendant of the practice-screen pills).
//   - 'illustrative': two corner indices (the classic upright + rotated pair)
//                     and a centre pip layout — pip count for A–10, a letter for
//                     court cards.
// Both honour the 4-/2-colour deck setting and dark mode. Face-down cards render
// a CardBack instead. A card is `card[0]` = suit (S/H/D/C), `card[1]` = rank.
import { cn } from '@/lib/utils'
import { useSettings } from '@/lib/settings'
import { SUIT_SYM, suitClass } from '@/practice/bridge'
import CardBack from './CardBack'

const RANK_LABEL = (r) => (r === 'T' ? '10' : r)
// A=1 so it shows a single centre pip; courts have no pip count.
const PIP_COUNT = { A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, T: 10 }
const RANK_NAME = {
  A: 'Ace', K: 'King', Q: 'Queen', J: 'Jack', T: 'Ten',
  '9': 'Nine', '8': 'Eight', '7': 'Seven', '6': 'Six', '5': 'Five',
  '4': 'Four', '3': 'Three', '2': 'Two',
}
const SUIT_NAME = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }

function CornerIndex({ rank, sym, color, className }) {
  return (
    <div className={cn('flex flex-col items-center leading-none', color, className)}>
      <span className="font-mono text-xs font-semibold tabular-nums sm:text-sm">{rank}</span>
      <span className="text-xs sm:text-sm">{sym}</span>
    </div>
  )
}

function Pips({ count, sym, color }) {
  return (
    <div className={cn('flex max-w-[70%] flex-wrap content-center justify-center gap-px text-[0.6rem] leading-none sm:text-xs', color)}>
      {Array.from({ length: count }).map((_, i) => <span key={i}>{sym}</span>)}
    </div>
  )
}

export default function PlayingCard({
  card, faceDown = false, variant, onPlay, disabled = false,
  best = false, dimmed = false, className,
}) {
  const { deck, cardStyle } = useSettings()
  if (faceDown) return <CardBack className={className} />

  const suit = card[0]
  const rank = card[1]
  const label = RANK_LABEL(rank)
  const sym = SUIT_SYM[suit]
  const color = suitClass(suit, deck)
  const style = variant || cardStyle
  const isCourt = rank === 'J' || rank === 'Q' || rank === 'K'
  const playable = !!onPlay && !disabled

  const face = style === 'illustrative' ? (
    <>
      <CornerIndex rank={label} sym={sym} color={color} className="absolute left-1 top-1 items-start" />
      <CornerIndex rank={label} sym={sym} color={color} className="absolute bottom-1 right-1 items-start rotate-180" />
      <div className="absolute inset-0 grid place-items-center px-2">
        {isCourt
          ? <span className={cn('text-xl font-bold leading-none sm:text-2xl', color)}>{label}</span>
          : <Pips count={PIP_COUNT[rank]} sym={sym} color={color} />}
      </div>
    </>
  ) : (
    <>
      <CornerIndex rank={label} sym={sym} color={color} className="absolute left-1 top-1 items-start" />
      <div className="absolute inset-0 grid place-items-center">
        <span className={cn('text-2xl leading-none sm:text-3xl', color)}>{sym}</span>
      </div>
    </>
  )

  const cls = cn(
    'relative block h-16 w-11 shrink-0 select-none rounded-lg border bg-card shadow-sm sm:h-20 sm:w-14',
    best && 'border-success ring-2 ring-success',
    !best && 'border-border',
    dimmed && 'opacity-60',
    playable && 'cursor-pointer transition hover:-translate-y-1 hover:shadow-md focus-visible:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    !playable && onPlay && 'opacity-50',
    className,
  )
  const aria = `${RANK_NAME[rank]} of ${SUIT_NAME[suit]}`

  if (onPlay) {
    return (
      <button type="button" aria-label={aria} disabled={!playable}
        onClick={() => playable && onPlay(card)} className={cls}>
        {face}
      </button>
    )
  }
  return <div role="img" aria-label={aria} className={cls}>{face}</div>
}
