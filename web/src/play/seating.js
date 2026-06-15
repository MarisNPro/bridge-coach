// Table geometry for the mobile "you-at-the-bottom" view. Bridge seats run
// clockwise N→E→S→W; play proceeds clockwise, so a seat's left-hand opponent is
// the next seat clockwise. Given the seat anchored at the bottom (the one the
// user plays), `relativeSeats` returns which absolute seat sits at each edge:
//   bottom = you, left = your LHO, top = your partner, right = your RHO.
export const CLOCKWISE = ['N', 'E', 'S', 'W']
export const PARTNER = { N: 'S', S: 'N', E: 'W', W: 'E' }

export function relativeSeats(bottom) {
  const i = CLOCKWISE.indexOf(bottom)
  if (i < 0) throw new Error(`bad seat: ${bottom}`)
  return {
    bottom,
    left: CLOCKWISE[(i + 1) % 4],
    top: CLOCKWISE[(i + 2) % 4],
    right: CLOCKWISE[(i + 3) % 4],
  }
}
