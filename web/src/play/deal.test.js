import { describe, it, expect } from 'vitest'
import { dealBoard, assessRequest, trickWinner, SEATS } from './deal'

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

describe('trickWinner', () => {
  // Led spades; in a heart contract a ruff wins.
  const trick = [
    { seat: 'N', card: 'SA' },
    { seat: 'E', card: 'H2' },
    { seat: 'S', card: 'SK' },
    { seat: 'W', card: 'C3' },
  ]

  it('a trump beats higher cards of the led suit', () => {
    expect(trickWinner(trick, 'H')).toBe('E') // H2 ruffs the spades
  })

  it('without a trump played, the highest card of the led suit wins', () => {
    expect(trickWinner(trick, 'NT')).toBe('N') // SA > SK, others off-suit
    expect(trickWinner(trick, 'C')).toBe('W')  // C3 is the only club (trump)
  })

  it('among trumps, the highest rank wins', () => {
    const t = [
      { seat: 'N', card: 'H2' }, { seat: 'E', card: 'HK' },
      { seat: 'S', card: 'HA' }, { seat: 'W', card: 'HQ' },
    ]
    expect(trickWinner(t, 'H')).toBe('S') // HA highest
  })
})
