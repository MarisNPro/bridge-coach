import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { SettingsProvider } from '@/lib/settings'

// Stable t (defined once) so usePlay's t-dependent fetch effect doesn't churn.
vi.mock('react-i18next', () => {
  const t = (k) => k
  return { useTranslation: () => ({ t }) }
})
vi.mock('../lib/engine', () => ({ playPosition: vi.fn(), playBot: vi.fn() }))

import { playPosition, playBot } from '../lib/engine'
import InteractivePlay from './InteractivePlay'

const board = {
  pbn: 'N:test',
  hands: {
    S: { S: 'A9', H: '', D: '', C: '' },   // declarer / user → bottom
    N: { S: '', H: 'KQ', D: '', C: '' },   // dummy / user → top
    E: { S: '', H: '', D: 'JT', C: '' },   // defender → right edge
    W: { S: '', H: '', D: '', C: '87' },   // defender → left edge
  },
}
const contract = { declarer: 'S', level: 4, strain: 'S' }
const renderPlay = () =>
  render(<SettingsProvider><InteractivePlay board={board} contract={contract} onExit={() => {}} /></SettingsProvider>)

beforeEach(() => {
  playPosition.mockReset(); playBot.mockReset()
  // Force the phone layout: the max-width query matches.
  window.matchMedia = (query) => ({
    matches: query.includes('max-width'),
    media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  })
})

describe('InteractivePlay — mobile layout', () => {
  it('plays a card from the bottom fan and refetches', async () => {
    playPosition.mockResolvedValue({
      to_act: 'S', trick: [], declarer_tricks: 0, defender_tricks: 0,
      legal: [{ card: 'SA', dd: 11 }, { card: 'S9', dd: 9 }], complete: false,
    })
    renderPlay()

    const nine = await screen.findByRole('button', { name: 'Nine of spades' })
    expect(nine).toBeEnabled()
    // The right-edge opponent (East) is concealed — no tappable card.
    expect(screen.queryByRole('button', { name: 'Jack of diamonds' })).toBeNull()

    fireEvent.click(nine)
    await waitFor(() => expect(playPosition).toHaveBeenCalledTimes(2))
    expect(playPosition.mock.calls[1][0].played).toEqual(['S9'])
  })

  it('reveals the concealed opponents through the "More" sheet', async () => {
    playPosition.mockResolvedValue({
      to_act: 'S', trick: [], declarer_tricks: 0, defender_tricks: 0,
      legal: [{ card: 'SA', dd: 11 }, { card: 'S9', dd: 9 }], complete: false,
    })
    renderPlay()
    await screen.findByRole('button', { name: 'Nine of spades' })

    expect(screen.queryByText('J 10')).toBeNull()           // East hidden
    fireEvent.click(screen.getByText('play.more'))
    fireEvent.click(screen.getByText('play.reveal'))
    expect(await screen.findByText('J 10')).toBeInTheDocument() // East's diamonds shown
  })
})
