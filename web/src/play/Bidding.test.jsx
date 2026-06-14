import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsProvider } from '@/lib/settings'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }))
vi.mock('../lib/engine', () => ({ getBid: vi.fn(), explainCall: vi.fn() }))

import { getBid, explainCall } from '../lib/engine'
import Bidding from './Bidding'

const board = {
  hands: {
    N: { S: '', H: '', D: '', C: '' }, E: { S: '', H: '', D: '', C: '' },
    S: { S: 'AKQ', H: 'AKQ', D: 'AKQ', C: 'AK2' }, W: { S: '', H: '', D: '', C: '' },
  },
}

beforeEach(() => { getBid.mockReset(); explainCall.mockReset() })

describe('Bidding', () => {
  it('auto-bids the bots and completes (passed out) when everyone passes', async () => {
    vi.useFakeTimers()
    getBid.mockResolvedValue({ call: 'Pass' })   // every bot passes
    const onComplete = vi.fn()
    render(<SettingsProvider><Bidding board={board} onComplete={onComplete} onCancel={() => {}} /></SettingsProvider>)

    // South (the user) is to act first (dealer S); pass.
    fireEvent.click(screen.getByRole('button', { name: 'Pass' }))
    await vi.runAllTimersAsync()                 // W, N, E auto-pass -> 4 passes

    expect(getBid).toHaveBeenCalled()            // bots were driven via /bid
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete.mock.calls[0][0].contract).toBeNull()  // passed out
    vi.useRealTimers()
  })

  it('explains a call when tapped', async () => {
    vi.useFakeTimers()
    getBid.mockResolvedValue({ call: 'Pass' })
    explainCall.mockResolvedValue({ text: 'Pass', meaning: 'no convenient action', variants: [] })
    render(<SettingsProvider><Bidding board={board} onComplete={() => {}} onCancel={() => {}} /></SettingsProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'Pass' }))  // user passes (the bidding box)
    await vi.runAllTimersAsync()                                    // auction completes; grid shows Pass cells

    fireEvent.click(screen.getAllByRole('button', { name: 'Pass' })[0]) // tap a grid call
    await vi.runAllTimersAsync()

    expect(explainCall).toHaveBeenCalled()
    expect(screen.getByText(/no convenient action/)).toBeInTheDocument()
    vi.useRealTimers()
  })
})
