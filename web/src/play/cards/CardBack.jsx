// The reverse of a card — shown for opponents' concealed hands. A themed,
// primary-tinted face with a subtle diagonal weave (see `.card-back` in
// index.css). Same footprint as PlayingCard so fans line up.
import { cn } from '@/lib/utils'

export default function CardBack({ className }) {
  return (
    <div aria-hidden="true"
      className={cn('card-back h-16 w-11 shrink-0 rounded-lg border border-primary/30 shadow-sm sm:h-20 sm:w-14', className)} />
  )
}
