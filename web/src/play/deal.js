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
