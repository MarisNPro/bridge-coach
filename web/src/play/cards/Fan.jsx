// A horizontally overlapping fan of cards — one hand on the play surface.
// Cards are grouped by suit (S H D C), overlapped within a suit so each keeps a
// tappable exposed strip, with a gap between suits. The active card lifts clear
// of its neighbours (see PlayingCard's hover/focus). Tapping a legal card calls
// `onPlay`; illegal cards are inert and dimmed.
//
// Props:
//   cards    - array of card strings ('SA', 'HT', …), any order
//   faceDown - render card-backs instead of faces (opponents)
//   legal    - Set of card strings that may be played (tappable)
//   best     - Set of card strings to highlight (the hint)
//   onPlay   - fn(card); omit for a non-interactive fan
//   disabled - whole fan inert (e.g. not your turn)
import { cn } from '@/lib/utils'
import PlayingCard from './PlayingCard'
import CardBack from './CardBack'

const SUITS = ['S', 'H', 'D', 'C']
// Overlap each card past the previous one in its suit (-0.75rem), leaving a
// ~28px exposed strip that lifts clear when the card is active.
const OVERLAP = '-ml-3'

export default function Fan({
  cards = [], faceDown = false, legal, best, onPlay, disabled = false, className,
}) {
  if (faceDown) {
    return (
      <div className={cn('flex items-end justify-center', className)} aria-hidden="true">
        {cards.length === 0
          ? <span className="text-muted-foreground">—</span>
          : cards.map((_, i) => <CardBack key={i} className={i > 0 ? OVERLAP : undefined} />)}
      </div>
    )
  }

  const legalSet = legal || new Set()
  const bestSet = best || new Set()
  const groups = SUITS.map((su) => [su, cards.filter((c) => c[0] === su)]).filter(([, cs]) => cs.length)

  return (
    <div className={cn('flex items-end justify-center', className)}>
      {groups.length === 0 && <span className="text-muted-foreground">—</span>}
      {groups.map(([su, suitCards], gi) => (
        <div key={su} className={cn('flex items-end', gi > 0 && 'ml-3')}>
          {suitCards.map((c, i) => (
            <PlayingCard
              key={c}
              card={c}
              onPlay={onPlay}
              disabled={disabled || !legalSet.has(c)}
              best={bestSet.has(c)}
              className={i > 0 ? OVERLAP : undefined}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
