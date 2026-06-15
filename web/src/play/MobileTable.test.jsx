import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsProvider } from '@/lib/settings'

// Keys-as-strings so assertions don't depend on translations.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }))

import MobileTable from './MobileTable'

const wrap = (ui) => render(<SettingsProvider>{ui}</SettingsProvider>)

// South plays (declarer), North is the revealed dummy, E/W are concealed.
const seats = {
  S: { cards: ['SA', 'S9'], faceDown: false, isTurn: true, interactive: true, legal: new Set(['SA']), best: new Set(['SA']), isDummy: false },
  N: { cards: ['HK', 'HQ'], faceDown: false, isTurn: false, interactive: false, legal: new Set(), best: new Set(), isDummy: true },
  W: { cards: ['C8', 'C7'], faceDown: true, isTurn: false, interactive: false, legal: new Set(), best: new Set(), isDummy: false },
  E: { cards: ['DJ', 'DT'], faceDown: true, isTurn: false, interactive: false, legal: new Set(), best: new Set(), isDummy: false },
}
const baseProps = (over = {}) => ({
  contract: { level: 4, strain: 'S', declarer: 'S' },
  bottomSeat: 'S',
  seatInfo: (s) => seats[s],
  onPlay: vi.fn(),
  trick: { N: 'H2', E: 'D3', S: 'S4', W: 'C5' },
  winnerSeat: 'S',
  phase: 'user',
  status: { made: 7, need: 10, defenderTricks: 3, projDelta: 1 },
  result: null,
  flags: { canUndo: true, canClaim: true, hidden: true, hint: false, defend: false, showModeToggle: true },
  actions: {
    onUndo: vi.fn(), onClaim: vi.fn(), onToggleReveal: vi.fn(),
    onToggleHint: vi.fn(), onToggleMode: vi.fn(), onExit: vi.fn(),
  },
  ...over,
})

describe('MobileTable', () => {
  it('plays a legal card from your hand and gates the illegal one', async () => {
    const p = baseProps()
    wrap(<MobileTable {...p} />)

    const ace = screen.getByRole('button', { name: 'Ace of spades' })
    const nine = screen.getByRole('button', { name: 'Nine of spades' })
    expect(ace).toBeEnabled()
    expect(nine).toBeDisabled()

    await userEvent.click(ace)
    await userEvent.click(nine)
    expect(p.onPlay).toHaveBeenCalledTimes(1)
    expect(p.onPlay).toHaveBeenCalledWith('SA')
  })

  it('shows opponents as concealed backs and the trick cards face up', () => {
    const { container } = wrap(<MobileTable {...baseProps()} />)
    expect(container.querySelectorAll('.card-back')).toHaveLength(2) // E + W edges
    // Each concealed opponent is announced to screen readers.
    expect(screen.getAllByLabelText('play.concealedHand')).toHaveLength(2)
    // The four played cards are present (distinct ranks from the hands).
    expect(screen.getByLabelText('Four of spades')).toBeInTheDocument()
    expect(screen.getByLabelText('Two of hearts')).toBeInTheDocument()
  })

  it('glows the winning trick card', () => {
    wrap(<MobileTable {...baseProps()} />) // winnerSeat 'S' → the S4 card
    expect(screen.getByLabelText('Four of spades').className).toContain('animate-winner')
  })

  it('exits and reaches the secondary actions through "More"', async () => {
    const p = baseProps()
    wrap(<MobileTable {...p} />)

    await userEvent.click(screen.getByLabelText('play.exit'))
    expect(p.actions.onExit).toHaveBeenCalled()

    await userEvent.click(screen.getByText('play.more'))
    await userEvent.click(screen.getByText('play.reveal'))
    expect(p.actions.onToggleReveal).toHaveBeenCalled()
  })

  it('renders the final result instead of a turn prompt when complete', () => {
    wrap(<MobileTable {...baseProps({ phase: 'complete', result: { makes: true, delta: 0, claimed: false } })} />)
    expect(screen.getByText('play.makesBy')).toBeInTheDocument()
    expect(screen.queryByText('play.yourTurn')).toBeNull()
  })
})
