// Pure auction helpers for the bidding phase. The auction is a list of calls in
// order from the dealer, going clockwise (N -> E -> S -> W). Opponents are NOT
// parenthesised here — seats are tracked by position from the dealer.
const SEATS = ['N', 'E', 'S', 'W']
const PAIR = { N: 'NS', S: 'NS', E: 'EW', W: 'EW' }

export function normalizeCall(c) {
  const s = String(c).trim().toUpperCase()
  if (s === 'P' || s === 'PASS') return 'Pass'
  if (s === 'X' || s === 'DBL' || s === 'DOUBLE') return 'X'
  if (s === 'XX' || s === 'RDBL' || s === 'REDOUBLE') return 'XX'
  return s // a bid, e.g. '1NT', '1S', '3H'
}

const isBid = (c) => /^[1-7](C|D|H|S|NT)$/.test(c)

export function seatAt(dealer, i) {
  return SEATS[(SEATS.indexOf(dealer) + i) % 4]
}

// True once the auction is over: three passes after any bid, or four passes from
// the start (passed out).
export function auctionComplete(calls) {
  const c = calls.map(normalizeCall)
  if (c.length < 4) return false
  if (!c.slice(-3).every((x) => x === 'Pass')) return false
  return c.some(isBid) || c.every((x) => x === 'Pass')
}

// Derive the final contract from a completed auction. Returns
// { level, strain, declarer, doubled } or null if passed out. Declarer is the
// FIRST player of the winning partnership to have named the final strain.
export function contractFromAuction(calls, dealer = 'N') {
  let last = null            // { level, strain, seat }
  let doubled = ''
  const bids = []            // { seat, strain } in order
  calls.forEach((raw, i) => {
    const c = normalizeCall(raw)
    const seat = seatAt(dealer, i)
    if (c === 'Pass') return
    if (c === 'X') { doubled = 'X'; return }
    if (c === 'XX') { doubled = 'XX'; return }
    if (!isBid(c)) return
    last = { level: +c[0], strain: c.slice(1), seat }
    doubled = ''             // a fresh bid clears any double
    bids.push({ seat, strain: last.strain })
  })
  if (!last) return null
  const pair = PAIR[last.seat]
  const declarer = bids.find((b) => PAIR[b.seat] === pair && b.strain === last.strain).seat
  return { level: last.level, strain: last.strain, declarer, doubled }
}

const dotted = (h) => `${h.S || ''}.${h.H || ''}.${h.D || ''}.${h.C || ''}`

// Translate the running absolute auction into the frame the engine bidder
// expects for `perspective`: our side's bids plain, opponents' bids/doubles in
// (parens), ALL passes plain, and leading (pre-opening) passes dropped. This
// matches the system's keys for openings / responses / opener-rebids /
// responder-over-interference. (Advancer keys use "(Pass)" and aren't matched —
// the bot simply passes there, which the adjust step compensates for.)
export function toEngineAuction(calls, dealer, perspective) {
  const out = []
  let started = false
  calls.forEach((raw, i) => {
    const c = normalizeCall(raw)
    if (!started) { if (c === 'Pass') return; started = true }
    if (c === 'Pass') { out.push('Pass'); return }
    out.push(PAIR[seatAt(dealer, i)] === PAIR[perspective] ? c : `(${c})`)
  })
  return out
}

// The bidding role of `seat` in this auction: opener (first to bid) / responder
// (its partner) / overcaller (first opponent to bid or double) / advancer.
export function roleOf(calls, dealer, seat) {
  let opener = null
  for (let i = 0; i < calls.length; i++) {
    if (isBid(normalizeCall(calls[i]))) { opener = seatAt(dealer, i); break }
  }
  if (!opener) return 'opener'                 // no bid yet -> this seat would open
  if (seat === opener) return 'opener'
  if (PAIR[seat] === PAIR[opener]) return 'responder'
  for (let i = 0; i < calls.length; i++) {
    const c = normalizeCall(calls[i])
    const s = seatAt(dealer, i)
    if (PAIR[s] !== PAIR[opener] && (isBid(c) || c === 'X' || c === 'XX')) {
      return seat === s ? 'overcaller' : 'advancer'
    }
  }
  return 'overcaller'                          // opponents haven't bid -> first to do so
}

// Ask the engine for the next seat's call. `getBid` is injected (the /bid client).
// Returns { seat, call, promised }; on any gap/error the seat passes.
export async function botCall(getBid, { hands, dealer, calls, systemId = 'natural-v1' }) {
  const seat = seatAt(dealer, calls.length)
  const auction = toEngineAuction(calls, dealer, seat)
  try {
    const r = await getBid({ hand: dotted(hands[seat]), auction, seat: roleOf(calls, dealer, seat), system_id: systemId })
    return { seat, call: normalizeCall(r.call), promised: r.promised ?? null }
  } catch {
    return { seat, call: 'Pass', promised: null }   // pass on any uncovered node
  }
}

// Intersect each seat's promised ranges across its calls into per-seat
// constraints for the bot, e.g. { E: { hcp: {min,max}, length: {spades:{min}} } }.
// `calls` is [{ seat, promised }]; calls without `promised` are ignored.
export function accumulateConstraints(calls) {
  const out = {}
  const tighten = (cur, val, fn) => (cur == null ? val : fn(cur, val))
  for (const { seat, promised } of calls) {
    if (!promised) continue
    const c = out[seat] || (out[seat] = {})
    if (promised.hcp) {
      c.hcp = c.hcp || {}
      if (promised.hcp.min != null) c.hcp.min = tighten(c.hcp.min, promised.hcp.min, Math.max)
      if (promised.hcp.max != null) c.hcp.max = tighten(c.hcp.max, promised.hcp.max, Math.min)
    }
    if (promised.length) {
      c.length = c.length || {}
      for (const [suit, rng] of Object.entries(promised.length)) {
        const L = c.length[suit] || (c.length[suit] = {})
        if (rng.min != null) L.min = tighten(L.min, rng.min, Math.max)
        if (rng.max != null) L.max = tighten(L.max, rng.max, Math.min)
      }
    }
  }
  return out
}
