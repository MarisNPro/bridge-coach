import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { SettingsProvider } from '@/lib/settings'

// Stable t so the fetch effect (which depends on t) doesn't churn.
vi.mock('react-i18next', () => {
  const t = (k) => k
  return { useTranslation: () => ({ t }) }
})
vi.mock('../lib/engine', () => ({ playPosition: vi.fn(), playBot: vi.fn() }))

import { playPosition, playBot } from '../lib/engine'
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

beforeEach(() => { playPosition.mockReset(); playBot.mockReset() })

describe('InteractivePlay orchestration', () => {
  it('fetches the opening position and lets the user play a legal card', async () => {
    playPosition.mockResolvedValue({
      to_act: 'S', trick: [], declarer_tricks: 0, defender_tricks: 0,
      legal: [{ card: 'SA', dd: 11 }, { card: 'S9', dd: 9 }], complete: false,
    })
    renderPlay()

    await waitFor(() => expect(playPosition).toHaveBeenCalledTimes(1))
    expect(playPosition.mock.calls[0][0]).toMatchObject({ strain: 'S', declarer: 'S', played: [] })

    // Declarer (the user) is visible and clickable; an opponent's card is hidden.
    const nine = await screen.findByRole('button', { name: '9' })
    expect(nine).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'J' })).toBeNull() // East face-down (hidden)

    fireEvent.click(nine)
    await waitFor(() => expect(playPosition).toHaveBeenCalledTimes(2))
    expect(playPosition.mock.calls[1][0].played).toEqual(['S9'])
  })

  it('hides opponents until revealed', async () => {
    playPosition.mockResolvedValue({
      to_act: 'S', trick: [], declarer_tricks: 0, defender_tricks: 0,
      legal: [{ card: 'SA', dd: 11 }, { card: 'S9', dd: 9 }], complete: false,
    })
    renderPlay()
    await screen.findByRole('button', { name: '9' })
    expect(screen.queryByRole('button', { name: 'J' })).toBeNull()   // East hidden
    fireEvent.click(screen.getByRole('button', { name: 'play.reveal' }))
    expect(await screen.findByRole('button', { name: 'J' })).toBeInTheDocument() // now shown
  })

  it('plays an opponent via the non-cheating bot (sees only its own hand at the lead)', async () => {
    vi.useFakeTimers()
    playBot.mockResolvedValue({ card: 'C8', to_act: 'W', samples: 16, candidates: [] })
    playPosition.mockImplementation((req = {}) => {
      const played = req.played ?? []
      return Promise.resolve(played.length === 0
        ? { to_act: 'W', trick: [], declarer_tricks: 0, defender_tricks: 0,
            legal: [{ card: 'C8', dd: 5 }, { card: 'C7', dd: 3 }], complete: false }
        : { to_act: 'S', trick: [{ seat: 'W', card: 'C8' }], declarer_tricks: 0, defender_tricks: 0,
            legal: [{ card: 'SA', dd: 11 }], complete: false })
    })

    renderPlay()
    await vi.runAllTimersAsync()   // initial fetch + 450ms bot turn + refetch

    expect(playBot).toHaveBeenCalled()
    const known = playBot.mock.calls[0][0].known_hands
    expect(known).toHaveProperty('W')            // the bot sees its own hand…
    expect(known).not.toHaveProperty('S')        // …not the declarer's
    expect(known).not.toHaveProperty('E')        // …nor its partner's
    // The bot's card was applied (refetch includes it).
    const calls = playPosition.mock.calls.map((c) => c[0]?.played ?? [])
    expect(calls.some((p) => p.length === 1 && p[0] === 'C8')).toBe(true)
    vi.useRealTimers()
  })

  it('defend mode: the user becomes the opening leader and declarer is hidden', async () => {
    playBot.mockReturnValue(new Promise(() => {}))   // pending: no opponent move during the test
    playPosition.mockResolvedValue({
      to_act: 'S', trick: [], declarer_tricks: 0, defender_tricks: 0,
      legal: [{ card: 'SA', dd: 11 }, { card: 'S9', dd: 9 }], complete: false,
    })
    renderPlay()
    // Declare mode (default): declarer S is visible.
    expect(await screen.findByRole('button', { name: '9' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'play.defendMode' }))

    // Now the user defends as W (declarer S's LHO): W's clubs show, declarer hidden.
    expect(await screen.findByRole('button', { name: '8' })).toBeInTheDocument() // West's club
    expect(screen.queryByRole('button', { name: '9' })).toBeNull()               // declarer hidden
  })

  it('claim resolves to the double-dummy result (not the bot)', async () => {
    vi.useFakeTimers()
    playPosition.mockImplementation((req = {}) => {
      const played = req.played ?? []
      return Promise.resolve(played.length === 0
        ? { to_act: 'S', trick: [], declarer_tricks: 0, defender_tricks: 0,
            legal: [{ card: 'SA', dd: 1 }], complete: false }
        : { to_act: 'S', trick: [], declarer_tricks: 1, defender_tricks: 0,
            legal: [], complete: true })
    })

    renderPlay()
    await vi.runAllTimersAsync()

    fireEvent.click(screen.getByRole('button', { name: 'play.claim' }))
    await vi.runAllTimersAsync()

    const calls = playPosition.mock.calls.map((c) => c[0]?.played ?? [])
    expect(calls.some((p) => p.length === 1 && p[0] === 'SA')).toBe(true)
    expect(playBot).not.toHaveBeenCalled()       // claim uses DD, not the bot
    expect(screen.getByText('play.claimed')).toBeInTheDocument()
    vi.useRealTimers()
  })
})
