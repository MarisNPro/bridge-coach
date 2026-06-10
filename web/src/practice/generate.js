// Generates practice problems. Each situation carries a stable `id` matching
// the engine's situation_id (so attempts.deal_id lines up for assignment
// progress). nextProblem(only) optionally restricts to one situation.
// Vetted pool: every entry stress-tested with 200k random hands — no errors,
// no null calls (engine/system/vet.py). Minor-suit (1C/1D) and 1NT responses
// were re-enabled once their rule gaps were closed with catch-all rules.
//
// Opener-rebid situations are different from the rest: the actor (opener) has
// already opened, so a fully random hand would be unrealistic (it might never
// have opened that bid). Those entries carry a `fits` predicate mirroring what
// the opening promised; nextProblem resamples until the dealt hand qualifies.
// The engine remains the sole grader — `fits` only shapes which hands we deal.
const RANKS = 'AKQJT98765432'
const SUITS = 'SHDC'
const ORDER = Object.fromEntries([...RANKS].map((r, i) => [r, i]))
const HCP = { A: 4, K: 3, Q: 2, J: 1 }

// Cheap features for the realism predicates below (counting only — the engine
// owns all bidding logic). hand is a dotted "S.H.D.C" holding.
function feat(hand) {
  const by = Object.fromEntries(SUITS.split('').map((s, i) => [s, hand.split('.')[i] || '']))
  const len = {}
  let hcp = 0
  for (const s of SUITS) {
    len[s] = by[s].length
    for (const c of by[s]) hcp += HCP[c] || 0
  }
  return { hcp, len }
}

// "Would this hand have opened 1X?" — mirrors the opening rules in natural-v1.
const no5Major = (f) => f.len.S < 5 && f.len.H < 5
const balanced = (f) => ['4333', '4432', '5332'].includes(
  Object.values(f.len).sort((a, b) => b - a).join(''))
// Opens one of a suit: 12-21, and NOT a balanced hand in the 1NT (15-17) or
// 2NT (20-21) range — those open notrump, not a suit.
const opensSuit = (f) => f.hcp >= 12 && f.hcp <= 21 &&
  !(balanced(f) && ((f.hcp >= 15 && f.hcp <= 17) || f.hcp >= 20))
const opened1C = (f) => opensSuit(f) && no5Major(f) && f.len.C >= 3 &&
  (f.len.C > f.len.D || (f.len.C === f.len.D && f.len.C <= 3)) // 3-3 minors open 1C; 4-4 open 1D
const opened1D = (f) => opensSuit(f) && no5Major(f) && f.len.D >= 4 && f.len.D >= f.len.C
const opened1H = (f) => opensSuit(f) && f.len.H >= 5 && f.len.H > f.len.S // 5-5 majors open 1S
const opened1S = (f) => opensSuit(f) && f.len.S >= 5 && f.len.S >= f.len.H

const POOL = [
  { id: 'opening',                 auction: [],                       seat: 'opener' },
  { id: 'resp-1c',                 auction: ['1C', 'Pass'],           seat: 'responder' },
  { id: 'resp-1d',                 auction: ['1D', 'Pass'],           seat: 'responder' },
  { id: 'resp-1h',                 auction: ['1H', 'Pass'],           seat: 'responder' },
  { id: 'resp-1s',                 auction: ['1S', 'Pass'],           seat: 'responder' },
  { id: 'resp-1nt',                auction: ['1NT', 'Pass'],          seat: 'responder' },
  { id: 'direct-over-1c',          auction: ['(1C)'],                 seat: 'overcaller' },
  { id: 'direct-over-1d',          auction: ['(1D)'],                 seat: 'overcaller' },
  { id: 'direct-over-1h',          auction: ['(1H)'],                 seat: 'overcaller' },
  { id: 'direct-over-1s',          auction: ['(1S)'],                 seat: 'overcaller' },
  { id: 'respond-takeout-over-1h', auction: ['(1H)', 'X', '(Pass)'],  seat: 'advancer' },
  { id: 'respond-takeout-over-1s', auction: ['(1S)', 'X', '(Pass)'],  seat: 'advancer' },
  { id: 'resp-1c-over-1d',         auction: ['1C', '(1D)'],           seat: 'responder' },
  { id: 'resp-1c-over-1h',         auction: ['1C', '(1H)'],           seat: 'responder' },
  { id: 'resp-1c-over-1s',         auction: ['1C', '(1S)'],           seat: 'responder' },
  { id: 'resp-1d-over-1h',         auction: ['1D', '(1H)'],           seat: 'responder' },
  { id: 'resp-1d-over-1s',         auction: ['1D', '(1S)'],           seat: 'responder' },
  { id: 'resp-1h-over-1s',         auction: ['1H', '(1S)'],           seat: 'responder' },
  { id: 'advance-1h-overcall-1s',  auction: ['(1H)', '1S', '(Pass)'], seat: 'advancer' },
  { id: 'opener-rebid-1c-1d',      auction: ['1C', 'Pass', '1D', 'Pass'], seat: 'opener', fits: opened1C },
  { id: 'opener-rebid-1c-1h',      auction: ['1C', 'Pass', '1H', 'Pass'], seat: 'opener', fits: opened1C },
  { id: 'opener-rebid-1c-1s',      auction: ['1C', 'Pass', '1S', 'Pass'], seat: 'opener', fits: opened1C },
  { id: 'opener-rebid-1d-1h',      auction: ['1D', 'Pass', '1H', 'Pass'], seat: 'opener', fits: opened1D },
  { id: 'opener-rebid-1d-1s',      auction: ['1D', 'Pass', '1S', 'Pass'], seat: 'opener', fits: opened1D },
  { id: 'opener-rebid-1h-1s',      auction: ['1H', 'Pass', '1S', 'Pass'], seat: 'opener', fits: opened1H },
  { id: 'opener-rebid-1c-1nt',     auction: ['1C', 'Pass', '1NT', 'Pass'], seat: 'opener', fits: opened1C },
  { id: 'opener-rebid-1d-1nt',     auction: ['1D', 'Pass', '1NT', 'Pass'], seat: 'opener', fits: opened1D },
  { id: 'opener-rebid-1h-1nt',     auction: ['1H', 'Pass', '1NT', 'Pass'], seat: 'opener', fits: opened1H },
  { id: 'opener-rebid-1s-1nt',     auction: ['1S', 'Pass', '1NT', 'Pass'], seat: 'opener', fits: opened1S },
  { id: 'opener-rebid-1h-2h',      auction: ['1H', 'Pass', '2H', 'Pass'], seat: 'opener', fits: opened1H },
  { id: 'opener-rebid-1s-2s',      auction: ['1S', 'Pass', '2S', 'Pass'], seat: 'opener', fits: opened1S },
  { id: 'opener-rebid-1h-2c',      auction: ['1H', 'Pass', '2C', 'Pass'], seat: 'opener', fits: opened1H },
  { id: 'opener-rebid-1h-2d',      auction: ['1H', 'Pass', '2D', 'Pass'], seat: 'opener', fits: opened1H },
  { id: 'opener-rebid-1s-2c',      auction: ['1S', 'Pass', '2C', 'Pass'], seat: 'opener', fits: opened1S },
  { id: 'opener-rebid-1s-2d',      auction: ['1S', 'Pass', '2D', 'Pass'], seat: 'opener', fits: opened1S },
  { id: 'opener-rebid-1s-2h',      auction: ['1S', 'Pass', '2H', 'Pass'], seat: 'opener', fits: opened1S },
  { id: 'opener-rebid-1d-2c',      auction: ['1D', 'Pass', '2C', 'Pass'], seat: 'opener', fits: opened1D },
]

// Ordered list of situation ids, for the coach's assignment dropdown.
export const SITUATIONS = POOL.map((s) => s.id)

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

// A hand for a situation: random, but for opener-rebid situations resampled
// until it matches what the opening promised (a ~10% hit rate, so the cap is
// never reached in practice; the last deal is a safe fallback).
function dealFor(sit) {
  let hand = randomHand()
  if (!sit.fits) return hand
  for (let i = 0; i < 5000 && !sit.fits(feat(hand)); i++) hand = randomHand()
  return hand
}

let counter = 0

// Next problem. If `only` is a situation id, restrict to it; else pick at random.
export function nextProblem(only = null) {
  const list = only ? POOL.filter((s) => s.id === only) : POOL
  const pool = list.length ? list : POOL
  const sit = pool[Math.floor(Math.random() * pool.length)]
  counter += 1
  return { id: `gen-${counter}`, n: counter, hand: dealFor(sit), auction: sit.auction, seat: sit.seat }
}
