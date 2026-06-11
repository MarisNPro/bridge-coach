import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { SettingsProvider } from '@/lib/settings'

// Stable t so the fetch effect (which depends on t) doesn't churn.
vi.mock('react-i18next', () => {
  const t = (k) => k
  return { useTranslation: () => ({ t }) }
})
vi.mock('../lib/engine', () => ({ playPosition: vi.fn() }))

import { playPosition } from '../lib/engine'
import InteractivePlay from './InteractivePlay'

// Declarer S (so partner/dummy = N; defenders = E, W). Distinct ranks per seat
// so card-button text is unambiguous.
const board = {
  pbn: 'N:test',
  hands: {
    S: { S: 'A9', H: '', D: '', C: '' },   // declarer / user
    N: { S: '', H: 'KQ', D: '', C: '' },   // dummy / user
    E: { S: '', H: '', D: 'JT', C: '' },   // defender
    W: { S: '', H: '', D: '', C: '87' },   // defender (clubs 8,7)
  },
}
const contract = { declarer: 'S', level: 4, strain: 'S' }
const renderPlay = () =>
  render(<SettingsProvider><InteractivePlay board={board} contract={contract} onExit={() => {}} /></SettingsProvider>)

beforeEach(() => playPosition.mockReset())

describe('InteractivePlay orchestration', () => {
  it('fetches the opening position and lets the user play a legal card', async () => {
    // Declarer (user) to act with two legal spades.
    playPosition.mockResolvedValue({
      to_act: 'S', trick: [], declarer_tricks: 0, defender_tricks: 0,
      legal: [{ card: 'SA', dd: 11 }, { card: 'S9', dd: 9 }], complete: false,
    })
    renderPlay()

    await waitFor(() => expect(playPosition).toHaveBeenCalledTimes(1))
    expect(playPosition.mock.calls[0][0]).toMatchObject({ strain: 'S', declarer: 'S', played: [] })

    // S's spades are clickable; a defender's card is not.
    const nine = await screen.findByRole('button', { name: '9' })
    expect(nine).toBeEnabled()
    expect(screen.getByRole('button', { name: 'J' })).toBeDisabled() // East's diamond

    fireEvent.click(nine)
    await waitFor(() => expect(playPosition).toHaveBeenCalledTimes(2))
    expect(playPosition.mock.calls[1][0].played).toEqual(['S9'])
  })

  it('auto-plays a defender with the best double-dummy card', async () => {
    vi.useFakeTimers()
    playPosition.mockImplementation((req = {}) => {
      const played = req.played ?? []
      return Promise.resolve(played.length === 0
        // West (defender) to act — best dd is C8.
        ? { to_act: 'W', trick: [], declarer_tricks: 0, defender_tricks: 0,
            legal: [{ card: 'C8', dd: 5 }, { card: 'C7', dd: 3 }], complete: false }
        : { to_act: 'S', trick: [{ seat: 'W', card: 'C8' }], declarer_tricks: 0, defender_tricks: 0,
            legal: [{ card: 'SA', dd: 11 }], complete: false })
    })

    renderPlay()
    await vi.runAllTimersAsync()   // initial fetch + 600ms auto-play + refetch

    // West (defender) was auto-played with its best-dd card.
    const calls = playPosition.mock.calls.map((c) => c[0]?.played ?? [])
    expect(calls.some((p) => p.length === 0)).toBe(true)      // initial position
    expect(calls.some((p) => p.length === 1 && p[0] === 'C8')).toBe(true) // defender auto-play
    vi.useRealTimers()
  })

  it('claim auto-plays our own cards through to the double-dummy result', async () => {
    vi.useFakeTimers()
    // Declarer (user) to act; after one card the hand is complete.
    playPosition.mockImplementation((req = {}) => {
      const played = req.played ?? []
      return Promise.resolve(played.length === 0
        ? { to_act: 'S', trick: [], declarer_tricks: 0, defender_tricks: 0,
            legal: [{ card: 'SA', dd: 1 }], complete: false }
        : { to_act: 'S', trick: [], declarer_tricks: 1, defender_tricks: 0,
            legal: [], complete: true })
    })

    renderPlay()
    await vi.runAllTimersAsync()  // initial fetch: S (user) to act — NOT auto-played

    // Without claiming, our seat is never auto-played; claiming resolves it.
    fireEvent.click(screen.getByRole('button', { name: 'play.claim' }))
    await vi.runAllTimersAsync()  // claim auto-plays SA + refetch -> complete

    const calls = playPosition.mock.calls.map((c) => c[0]?.played ?? [])
    expect(calls.some((p) => p.length === 1 && p[0] === 'SA')).toBe(true)
    expect(screen.getByText('play.claimed')).toBeInTheDocument()
    vi.useRealTimers()
  })
})
