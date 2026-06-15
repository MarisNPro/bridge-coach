// Bridge presentation helpers. Suit colors follow the deck-color setting
// (4-color: each suit distinct; 2-color: classic black/red).
import { cn } from '@/lib/utils'
import { useSettings } from '@/lib/settings'

export const SUIT_SYM = { C: '♣', D: '♦', H: '♥', S: '♠' }

// Tailwind text-color class for a suit, honouring the deck-color setting
// (4-color: each suit distinct; 2-color: classic black/red). Exported so the
// play surface (cards, fans) colours suits the same way the rest of the app does.
export function suitClass(s, deck) {
  if (deck === '2color') return s === 'H' || s === 'D' ? 'text-suit-hearts' : 'text-foreground'
  return { S: 'text-suit-spades', H: 'text-suit-hearts', D: 'text-suit-diamonds', C: 'text-suit-clubs' }[s]
}

function Strain({ s }) {
  const { deck } = useSettings()
  if (s === 'NT') return <span className="font-semibold">NT</span>
  return <span className={suitClass(s, deck)}>{SUIT_SYM[s]}</span>
}

// A single suit symbol coloured by the current deck setting (S/H/D/C).
export function SuitGlyph({ s, className }) {
  const { deck } = useSettings()
  return <span className={cn(suitClass(s, deck), className)}>{SUIT_SYM[s]}</span>
}

// Render a single call. Internal formats: 'Pass', 'X', 'XX', '1H', '1NT', '(1S)'…
export function Call({ value }) {
  const v = String(value).trim()
  const paren = v.startsWith('(') && v.endsWith(')')
  const inner = (paren ? v.slice(1, -1) : v).trim()

  let body
  if (inner === 'Pass') body = <span>Pass</span>
  else if (inner === 'X') body = <span>Dbl</span>
  else if (inner === 'XX') body = <span>Rdbl</span>
  else {
    const m = inner.match(/^([1-7])(NT|[CDHS])$/)
    body = m ? <span className="tabular-nums">{m[1]}<Strain s={m[2]} /></span> : <span>{inner}</span>
  }
  if (paren) return <span className="text-muted-foreground">({body})</span>
  return body
}

// Render a 13-card hand from a dotted 'S.H.D.C' holding, as suit-grouped pills.
export function Hand({ hand, className }) {
  const { deck } = useSettings()
  const parts = String(hand).toUpperCase().split('.')
  const suits = ['S', 'H', 'D', 'C']
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {suits.map((s, i) => {
        const ranks = (parts[i] || '').split('').map((c) => (c === 'T' ? '10' : c))
        return (
          <div key={s} className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2">
            <span className={cn('w-5 text-center text-xl font-bold leading-none', suitClass(s, deck))}>
              {SUIT_SYM[s]}
            </span>
            <span className="font-mono text-lg tracking-[0.15em] tabular-nums">
              {ranks.length ? ranks.join(' ') : <span className="text-muted-foreground">—</span>}
            </span>
          </div>
        )
      })}
    </div>
  )
}
