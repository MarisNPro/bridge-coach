import { describe, it, expect } from 'vitest'
import { weak2Override, weak2Range, WEAK2_KEYS } from './toggles'

describe('weak2 presets', () => {
  it('standard sends no override (default path preserved)', () => {
    expect(weak2Override('standard')).toBeNull()
    expect(weak2Override(undefined)).toBeNull()
    expect(weak2Override('bogus')).toBeNull()
  })

  it('non-default presets map to a weak2_range override', () => {
    expect(weak2Override('aggressive')).toEqual({ weak2_range: { min: 5, max: 11 } })
    expect(weak2Override('disciplined')).toEqual({ weak2_range: { min: 8, max: 10 } })
  })

  it('weak2Range always resolves (falls back to standard)', () => {
    expect(weak2Range('aggressive')).toEqual({ min: 5, max: 11 })
    expect(weak2Range('nope')).toEqual({ min: 6, max: 10 })
  })

  it('exposes all preset keys', () => {
    expect(WEAK2_KEYS).toContain('standard')
    expect(WEAK2_KEYS).toContain('aggressive')
    expect(WEAK2_KEYS).toContain('disciplined')
  })
})
