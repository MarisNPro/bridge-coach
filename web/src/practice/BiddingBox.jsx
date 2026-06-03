import { Call } from './bridge'

const LEVELS = [1, 2, 3, 4, 5, 6, 7]
const STRAINS = ['C', 'D', 'H', 'S', 'NT']

// Tappable bidding box. Emits internal call values: 'Pass','X','XX','1C'…'7NT'.
// Bidding legality isn't enforced — the engine grades the call regardless.
export default function BiddingBox({ value, onSelect }) {
  const cell = (call, label) => {
    const active = value === call
    return (
      <button
        key={call}
        onClick={() => onSelect(call)}
        style={{
          padding: '8px 0', minWidth: 46, fontSize: 17, cursor: 'pointer',
          border: active ? '2px solid #2d6cdf' : '1px solid #bbb', borderRadius: 6,
          background: active ? '#eaf1ff' : '#fff', fontWeight: active ? 700 : 400,
        }}
      >
        {label}
      </button>
    )
  }

  return (
    <div style={{ display: 'inline-block' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {cell('Pass', <Call value="Pass" />)}
        {cell('X', <Call value="X" />)}
        {cell('XX', <Call value="XX" />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STRAINS.length}, 46px)`, gap: 6 }}>
        {LEVELS.map((lvl) =>
          STRAINS.map((st) => {
            const call = `${lvl}${st}`
            return cell(call, <Call value={call} />)
          })
        )}
      </div>
    </div>
  )
}
