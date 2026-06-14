import { describe, it, expect } from 'vitest'
import { contractFromAuction, accumulateConstraints, auctionComplete, seatAt } from './auction'

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
