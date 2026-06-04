// Generates practice problems. Each situation carries a stable `id` matching
// the engine's situation_id (so attempts.deal_id lines up for assignment
// progress). nextProblem(only) optionally restricts to one situation.
// Vetted pool: every entry stress-tested with 1500+ random hands — no errors,
// no null calls. (Minor-suit/1NT responses excluded: rule gaps in natural-v1.)
const POOL = [
  { id: 'opening',                 auction: [],                       seat: 'opener' },
  { id: 'resp-1h',                 auction: ['1H', 'Pass'],           seat: 'responder' },
  { id: 'resp-1s',                 auction: ['1S', 'Pass'],           seat: 'responder' },
  { id: 'direct-over-1c',          auction: ['(1C)'],                 seat: 'overcaller' },
  { id: 'direct-over-1d',          auction: ['(1D)'],                 seat: 'overcaller' },
  { id: 'direct-over-1h',          auction: ['(1H)'],                 seat: 'overcaller' },
  { id: 'direct-over-1s',          auction: ['(1S)'],                 seat: 'overcaller' },
  { id: 'respond-takeout-over-1h', auction: ['(1H)', 'X', '(Pass)'],  seat: 'advancer' },
  { id: 'respond-takeout-over-1s', auction: ['(1S)', 'X', '(Pass)'],  seat: 'advancer' },
  { id: 'resp-1h-over-1s',         auction: ['1H', '(1S)'],           seat: 'responder' },
  { id: 'advance-1h-overcall-1s',  auction: ['(1H)', '1S', '(Pass)'], seat: 'advancer' },
]

// Ordered list of situation ids, for the coach's assignment dropdown.
export const SITUATIONS = POOL.map((s) => s.id)

const RANKS = 'AKQJT98765432'
const SUITS = 'SHDC'
const ORDER = Object.fromEntries([...RANKS].map((r, i) => [r, i]))

function randomHand() {
  const deck = []
  for (const s of SUITS) for (const r of RANKS) deck.push([s, r])
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  const by = { S: '', H: '', D: '', C: '' }
  for (const [s, r] of deck.slice(0, 13)) by[s] += r
  return [...SUITS].map((s) => [...by[s]].sort((a, b) => ORDER[a] - ORDER[b]).join('')).join('.')
}

let counter = 0

// Next problem. If `only` is a situation id, restrict to it; else pick at random.
export function nextProblem(only = null) {
  const list = only ? POOL.filter((s) => s.id === only) : POOL
  const pool = list.length ? list : POOL
  const sit = pool[Math.floor(Math.random() * pool.length)]
  counter += 1
  return { id: `gen-${counter}`, situationId: sit.id, n: counter, hand: randomHand(), auction: sit.auction, seat: sit.seat }
}
