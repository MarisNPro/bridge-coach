// First practice set. Every deal's (auction, seat) maps to a real situation in
// natural-v1, and each hand was validated to resolve to a call via the engine.
// The engine remains the source of truth — these only supply the problem.
// hand is a dotted S.H.D.C holding ('T' = ten); opponents' calls are in (parens).
export const DEALS = [
  { id: 'open-1nt',        hand: 'AQ4.KJ3.KQ52.432',   auction: [],                       seat: 'opener' },
  { id: 'open-1major',     hand: 'AKJ75.Q842.K93.5',   auction: [],                       seat: 'opener' },
  { id: 'open-pass',       hand: 'J84.Q953.K64.T52',   auction: [],                       seat: 'opener' },
  { id: 'open-2c',         hand: 'AKQ5.AKJ4.AK3.42',   auction: [],                       seat: 'opener' },
  { id: 'resp-1h',         hand: 'K5.Q842.AT64.K83',   auction: ['1H', 'Pass'],           seat: 'responder' },
  { id: 'resp-1nt',        hand: 'KJ85.Q3.A642.J84',   auction: ['1NT', 'Pass'],          seat: 'responder' },
  { id: 'overcall-1h',     hand: 'AQT62.4.KJ83.Q95',   auction: ['(1H)'],                 seat: 'overcaller' },
  { id: 'takeout-adv',     hand: '43.KJ75.Q864.A52',   auction: ['(1S)', 'X', '(Pass)'],  seat: 'advancer' },
  { id: 'comp-1c-1s',      hand: '84.KQ95.AT62.752',   auction: ['1C', '(1S)'],           seat: 'responder' },
]
