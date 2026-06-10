import { describe, it, expect } from 'vitest'
import { nextProblem, SITUATIONS } from './generate'

const HCP = { A: 4, K: 3, Q: 2, J: 1 }
const hcpOf = (hand) => [...hand].reduce((a, c) => a + (HCP[c] || 0), 0)

describe('generate', () => {
  it('exposes a pool of situation ids including the key ones', () => {
    expect(SITUATIONS.length).toBeGreaterThan(10)
    expect(SITUATIONS).toContain('opening')
    expect(SITUATIONS).toContain('resp-1nt')
    expect(SITUATIONS).toContain('opener-rebid-1h-2h')
  })

  it('produces a valid 13-card problem with an auction and seat', () => {
    const p = nextProblem()
    const lengths = p.hand.split('.').map((s) => s.length)
    expect(lengths.reduce((a, b) => a + b, 0)).toBe(13)
    expect(Array.isArray(p.auction)).toBe(true)
    expect(['opener', 'responder', 'overcaller', 'advancer']).toContain(p.seat)
  })

  it('deals realistic openers for opener-rebid drills (1C: 12-21, 3+ clubs, no 5-card major)', () => {
    for (let i = 0; i < 60; i++) {
      const { hand } = nextProblem('opener-rebid-1c-1h')
      const [s, h, , c] = hand.split('.')
      const hcp = hcpOf(hand)
      expect(hcp).toBeGreaterThanOrEqual(12)
      expect(hcp).toBeLessThanOrEqual(21)
      expect(s.length).toBeLessThan(5)   // no 5-card major
      expect(h.length).toBeLessThan(5)
      expect(c.length).toBeGreaterThanOrEqual(3)
    }
  })
})
