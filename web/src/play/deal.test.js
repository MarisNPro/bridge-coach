import { describe, it, expect } from 'vitest'
import { dealBoard, assessRequest, SEATS } from './deal'

const SUITS = ['S', 'H', 'D', 'C']
const cardsOf = (h) => SUITS.flatMap((su) => [...(h[su] || '')].map((r) => su + r))

describe('dealBoard', () => {
  it('deals four 13-card hands using all 52 cards exactly once', () => {
    const { hands, pbn } = dealBoard()
    expect(SEATS).toEqual(['N', 'E', 'S', 'W'])
    const all = []
    for (const seat of SEATS) {
      const cards = cardsOf(hands[seat])
      expect(cards).toHaveLength(13)
      all.push(...cards)
    }
    expect(new Set(all).size).toBe(52)
  })

  it('formats a PBN deal string (N: + four space-separated holdings)', () => {
    const { pbn } = dealBoard()
    expect(pbn.startsWith('N:')).toBe(true)
    expect(pbn.slice(2).trim().split(' ')).toHaveLength(4)
  })
})

describe('assessRequest', () => {
  it('uses the declarer as dealer and opens the chosen contract', () => {
    const req = assessRequest('N:deal', { declarer: 'S', level: 4, strain: 'S', doubled: '' }, 'none')
    expect(req).toMatchObject({ deal: 'N:deal', dealer: 'S', vul: 'none' })
    expect(req.final_auction[0]).toBe('4S')
  })

  it('appends X for doubled and X+XX for redoubled', () => {
    const x = assessRequest('d', { declarer: 'N', level: 3, strain: 'NT', doubled: 'X' }).final_auction
    expect(x).toContain('X')
    expect(x).not.toContain('XX')
    const xx = assessRequest('d', { declarer: 'N', level: 3, strain: 'NT', doubled: 'XX' }).final_auction
    expect(xx).toContain('X')
    expect(xx).toContain('XX')
  })
})
