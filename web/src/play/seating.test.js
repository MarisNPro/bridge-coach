import { describe, it, expect } from 'vitest'
import { relativeSeats, PARTNER } from './seating'

describe('relativeSeats', () => {
  it('anchors South at the bottom with the expected table around it', () => {
    expect(relativeSeats('S')).toEqual({ bottom: 'S', left: 'W', top: 'N', right: 'E' })
  })

  it('places the partner across the top for every seat', () => {
    for (const seat of ['N', 'E', 'S', 'W']) {
      expect(relativeSeats(seat).top).toBe(PARTNER[seat])
    }
  })

  it('keeps left and right as the two opponents', () => {
    const { left, right, top, bottom } = relativeSeats('W')
    expect(new Set([left, right])).toEqual(new Set(['N', 'S'])) // W/E are partners
    expect(new Set([top, bottom])).toEqual(new Set(['W', 'E']))
  })

  it('rejects a bad seat', () => {
    expect(() => relativeSeats('X')).toThrow()
  })
})
