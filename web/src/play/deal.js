// Deal a full random board and format it as a PBN deal string for /assess.
const RANKS = 'AKQJT98765432'
const SUITS = 'SHDC'
const ORDER = Object.fromEntries([...RANKS].map((r, i) => [r, i]))
export const SEATS = ['N', 'E', 'S', 'W']

function holdingsBySuit(cards) {
  const by = { S: '', H: '', D: '', C: '' }
  for (const [s, r] of cards) by[s] += r
  return Object.fromEntries(
    [...SUITS].map((s) => [s, [...by[s]].sort((a, b) => ORDER[a] - ORDER[b]).join('')]),
  )
}

// Returns { hands: { N: {S,H,D,C}, ... }, pbn: "N:.. .. .. .." }.
export function dealBoard() {
  const deck = []
  for (const s of SUITS) for (const r of RANKS) deck.push([s, r])
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  const hands = {}
  SEATS.forEach((seat, i) => { hands[seat] = holdingsBySuit(deck.slice(i * 13, i * 13 + 13)) })
  const dotted = (h) => `${h.S || ''}.${h.H || ''}.${h.D || ''}.${h.C || ''}`
  const pbn = `N:${SEATS.map((s) => dotted(hands[s])).join(' ')}`
  return { hands, pbn }
}

// Winner of a completed trick. `cards` is [{ seat, card }] in play order (card
// like 'SA', 'HT'); `strain` is the trump suit ('S'|'H'|'D'|'C') or 'NT'.
// Highest trump wins; otherwise the highest card of the suit led.
export function trickWinner(cards, strain) {
  if (!cards || cards.length === 0) return null
  const led = cards[0].card[0]
  const trump = strain === 'NT' ? null : strain
  const score = ({ card }) => {
    const [suit, rank] = card
    const rankScore = RANKS.length - ORDER[rank] // A highest (13) … 2 lowest (1)
    if (trump && suit === trump) return 2000 + rankScore
    if (suit === led) return 1000 + rankScore
    return rankScore
  }
  return cards.reduce((best, c) => (score(c) > score(best) ? c : best), cards[0]).seat
}

// Double-dummy projection of the declarer's final trick total from the current
// position, assuming best play by both sides. `eng` is a /play response
// ({ declarer_tricks, defender_tricks, legal:[{dd}], to_act }); `declarerSeats`
// is [declarer, dummy]. `legal[].dd` is the best the side to act can still take.
export function projectedDeclarerTricks(eng, declarerSeats) {
  if (!eng) return 0
  if (!eng.legal || eng.legal.length === 0) return eng.declarer_tricks // complete
  const best = Math.max(...eng.legal.map((l) => l.dd))
  if (declarerSeats.includes(eng.to_act)) return eng.declarer_tricks + best
  const tricksLeft = 13 - eng.declarer_tricks - eng.defender_tricks
  return eng.declarer_tricks + (tricksLeft - best) // defender to act: best is theirs
}

// Build the /assess request for a chosen contract. We synthesise a minimal
// auction with the declarer as dealer, so the engine derives exactly this
// declarer/level/strain/double without needing a real auction.
export function assessRequest(pbn, { declarer, level, strain, doubled }, vul = 'none') {
  const calls = [`${level}${strain}`]
  if (doubled === 'X' || doubled === 'XX') calls.push('X')
  if (doubled === 'XX') calls.push('XX')
  while (calls.length < 4) calls.push('Pass') // pass it out
  return { deal: pbn, final_auction: calls, dealer: declarer, vul }
}
