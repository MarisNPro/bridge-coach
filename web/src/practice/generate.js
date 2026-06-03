// Generates unlimited practice problems: a random 13-card hand dropped into a
// vetted situation. Every (auction, seat) below was stress-tested with 1500+
// random hands and never errors or returns a null call. Minor-suit and 1NT
// responses are deliberately excluded (rule gaps in natural-v1 produce null
// calls on some hands — a content fix for later).
const POOL = [
  { auction: [], seat: 'opener' },                          // open the bidding
  { auction: ['1H', 'Pass'], seat: 'responder' },           // partner opened 1H
  { auction: ['1S', 'Pass'], seat: 'responder' },           // partner opened 1S
  { auction: ['(1C)'], seat: 'overcaller' },                // RHO opened 1C
  { auction: ['(1D)'], seat: 'overcaller' },                // RHO opened 1D
  { auction: ['(1H)'], seat: 'overcaller' },                // RHO opened 1H
  { auction: ['(1S)'], seat: 'overcaller' },                // RHO opened 1S
  { auction: ['(1H)', 'X', '(Pass)'], seat: 'advancer' },   // partner doubled 1H
  { auction: ['(1S)', 'X', '(Pass)'], seat: 'advancer' },   // partner doubled 1S
  { auction: ['1H', '(1S)'], seat: 'responder' },           // partner 1H, RHO 1S
  { auction: ['(1H)', '1S', '(Pass)'], seat: 'advancer' },  // partner overcalled 1S
]

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
  return [...SUITS]
    .map((s) => [...by[s]].sort((a, b) => ORDER[a] - ORDER[b]).join(''))
    .join('.')
}

let counter = 0

// Next practice problem: a fresh random hand in a randomly chosen situation.
export function nextProblem() {
  const sit = POOL[Math.floor(Math.random() * POOL.length)]
  counter += 1
  return { id: `gen-${counter}`, n: counter, hand: randomHand(), auction: sit.auction, seat: sit.seat }
}
