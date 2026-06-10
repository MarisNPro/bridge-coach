import { cn } from '@/lib/utils'
import { Call } from './bridge'

const LEVELS = [1, 2, 3, 4, 5, 6, 7]
const STRAINS = ['C', 'D', 'H', 'S', 'NT']

// Tappable bidding box. Emits internal call values: 'Pass','X','XX','1C'…'7NT'.
// Bidding legality isn't enforced — the engine grades the call regardless.
export default function BiddingBox({ value, onSelect }) {
  const Cell = ({ call, children, className }) => {
    const active = value === call
    return (
      <button
        type="button"
        onClick={() => onSelect(call)}
        aria-pressed={active}
        className={cn(
          'flex h-11 items-center justify-center rounded-md border text-base font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          active
            ? 'border-primary bg-primary/10 ring-2 ring-primary'
            : 'border-border bg-card hover:bg-accent',
          className,
        )}
      >
        {children}
      </button>
    )
  }

  return (
    <div className="w-full max-w-sm space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <Cell call="Pass"><Call value="Pass" /></Cell>
        <Cell call="X"><Call value="X" /></Cell>
        <Cell call="XX"><Call value="XX" /></Cell>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {LEVELS.map((lvl) =>
          STRAINS.map((st) => {
            const call = `${lvl}${st}`
            return <Cell key={call} call={call}><Call value={call} /></Cell>
          }),
        )}
      </div>
    </div>
  )
}
