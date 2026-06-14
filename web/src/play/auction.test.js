import { describe, it, expect } from 'vitest'
import { contractFromAuction, accumulateConstraints, auctionComplete, seatAt, toEngineAuction, roleOf, botCall } from './auction'
import { vi } from 'vitest'

describe('seatAt', () => {
  it('rotates clockwise from the dealer', () => {
    expect(seatAt('N', 0)).toBe('N')
    expect(seatAt('N', 1)).toBe('E')
    expect(seatAt('S', 1)).toBe('W')
    expect(seatAt('W', 1)).toBe('N')
  })
})

describe('auctionComplete', () => {
  it('ends after three passes following a bid', () => {
    expect(auctionComplete(['1S', 'P', 'P', 'P'])).toBe(true)
    expect(auctionComplete(['1S', 'P', 'P'])).toBe(false)
    expect(auctionComplete(['1S', 'P'])).toBe(false)
  })
  it('ends on four passes (passed out) but not three from the start', () => {
    expect(auctionComplete(['P', 'P', 'P', 'P'])).toBe(true)
    expect(auctionComplete(['P', 'P', 'P'])).toBe(false)
  })
})

describe('contractFromAuction', () => {
  it('returns null when passed out', () => {
    expect(contractFromAuction(['P', 'P', 'P', 'P'], 'N')).toBeNull()
  })

  it('declarer is the opener who first named the strain', () => {
    // N 1NT, S 3NT -> 3NT by NS; N named NT first -> declarer N.
    expect(contractFromAuction(['1NT', 'P', '3NT', 'P', 'P', 'P'], 'N'))
      .toEqual({ level: 3, strain: 'NT', declarer: 'N', doubled: '' })
  })

  it('declarer can be the partner who named the strain first', () => {
    // N 1D, S 1H, N 4H -> 4H by NS; S named H first -> declarer S.
    expect(contractFromAuction(['1D', 'P', '1H', 'P', '4H', 'P', 'P', 'P'], 'N'))
      .toEqual({ level: 4, strain: 'H', declarer: 'S', doubled: '' })
  })

  it('tracks doubles and redoubles on the final contract', () => {
    expect(contractFromAuction(['1S', 'X', 'P', 'P', 'P'], 'N'))
      .toEqual({ level: 1, strain: 'S', declarer: 'N', doubled: 'X' })
    expect(contractFromAuction(['1S', 'X', 'XX', 'P', 'P', 'P'], 'N'))
      .toEqual({ level: 1, strain: 'S', declarer: 'N', doubled: 'XX' })
  })

  it('a later bid clears an earlier double', () => {
    // N 1S, E X, N 2S -> the X is cleared by 2S.
    expect(contractFromAuction(['1S', 'X', 'P', 'P', '2S', 'P', 'P', 'P'], 'N'))
      .toMatchObject({ level: 2, strain: 'S', declarer: 'N', doubled: '' })
  })
})

describe('accumulateConstraints', () => {
  it('intersects hcp ranges across a seat’s calls', () => {
    const out = accumulateConstraints([
      { seat: 'E', promised: { hcp: { min: 12 } } },
      { seat: 'E', promised: { hcp: { min: 15, max: 17 } } },
    ])
    expect(out.E.hcp).toEqual({ min: 15, max: 17 })
  })

  it('intersects suit-length ranges and keeps seats separate', () => {
    const out = accumulateConstraints([
      { seat: 'W', promised: { length: { spades: { min: 5 } } } },
      { seat: 'W', promised: { length: { spades: { min: 6 } } } },
      { seat: 'N', promised: { hcp: { min: 6, max: 9 } } },
    ])
    expect(out.W.length.spades).toEqual({ min: 6 })
    expect(out.N.hcp).toEqual({ min: 6, max: 9 })
  })

  it('ignores calls without promised data', () => {
    expect(accumulateConstraints([{ seat: 'E' }, { seat: 'E', promised: null }])).toEqual({})
  })
})

describe('toEngineAuction', () => {
  it('frames an uncontested response from the responder (partner plain, opp pass plain)', () => {
    // N opens 1C, E passes; from S (partner) -> ['1C','Pass'] (matches resp-1c).
    expect(toEngineAuction(['1C', 'Pass'], 'N', 'S')).toEqual(['1C', 'Pass'])
  })

  it('parenthesises opponents’ bids', () => {
    // N 1C, E 1S; from S -> ['1C','(1S)'] (matches resp-1c-over-1s).
    expect(toEngineAuction(['1C', '1S'], 'N', 'S')).toEqual(['1C', '(1S)'])
  })

  it('drops leading passes before the opening', () => {
    // E deals & passes, S passes, W passes, N opens 1C; from S -> ['1C'].
    expect(toEngineAuction(['Pass', 'Pass', 'Pass', '1C'], 'E', 'S')).toEqual(['1C'])
  })
})

describe('roleOf', () => {
  it('classifies opener / responder / overcaller / advancer', () => {
    expect(roleOf(['1C'], 'N', 'N')).toBe('opener')
    expect(roleOf(['1C'], 'N', 'S')).toBe('responder')
    expect(roleOf(['1C', '1S'], 'N', 'E')).toBe('overcaller')
    expect(roleOf(['1C', '1S'], 'N', 'W')).toBe('advancer')
    expect(roleOf([], 'N', 'N')).toBe('opener')   // no bid yet
  })
})

describe('botCall', () => {
  const hands = { N: { S: 'AK', H: 'Q', D: 'J', C: '' }, E: {}, S: {}, W: {} }

  it('frames the auction + role and returns the engine call + promised', async () => {
    const getBid = vi.fn().mockResolvedValue({ call: '1C', promised: { hcp: { min: 12 } } })
    const r = await botCall(getBid, { hands, dealer: 'N', calls: [] })
    expect(r).toEqual({ seat: 'N', call: '1C', promised: { hcp: { min: 12 } } })
    expect(getBid).toHaveBeenCalledWith({ hand: 'AK.Q.J.', auction: [], seat: 'opener', system_id: 'natural-v1' })
  })

  it('passes on any uncovered node (engine error)', async () => {
    const getBid = vi.fn().mockRejectedValue(new Error('no situation for auction'))
    const r = await botCall(getBid, { hands, dealer: 'N', calls: [] })
    expect(r).toEqual({ seat: 'N', call: 'Pass', promised: null })
  })
})
