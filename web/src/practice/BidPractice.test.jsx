import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SettingsProvider } from '@/lib/settings'

vi.mock('react-i18next', () => {
  const t = (k) => k
  return { useTranslation: () => ({ t }) }
})
vi.mock('../lib/engine', () => ({ checkConformance: vi.fn(), getBid: vi.fn(), explainCall: vi.fn() }))
vi.mock('../lib/attempts', () => ({
  recordAttempt: vi.fn(() => Promise.resolve()),
  fetchStats: vi.fn(() => Promise.resolve(null)),
}))

import { checkConformance } from '../lib/engine'
import { recordAttempt } from '../lib/attempts'
import BidPractice from './BidPractice'

const renderPractice = () => render(<SettingsProvider><BidPractice /></SettingsProvider>)

beforeEach(() => {
  checkConformance.mockReset()
  recordAttempt.mockClear()
})

describe('BidPractice grade-and-record loop', () => {
  it('grades the selected call and records the attempt', async () => {
    checkConformance.mockResolvedValue({
      conformant: true, expected_call: '1NT', expected_meaning: 'Balanced 15-17', situation_id: 'opening',
    })
    renderPractice()

    fireEvent.click(screen.getByRole('button', { name: '1NT' }))          // bidding box
    fireEvent.click(screen.getByRole('button', { name: 'practice.check' }))

    await waitFor(() => expect(checkConformance).toHaveBeenCalledTimes(1))
    expect(checkConformance.mock.calls[0][0]).toMatchObject({ call: '1NT' })
    expect(await screen.findByText('practice.correct')).toBeInTheDocument()
    await waitFor(() => expect(recordAttempt).toHaveBeenCalledTimes(1))
    expect(recordAttempt.mock.calls[0][0]).toMatchObject({ your_call: '1NT', conformant: true })
  })

  it('shows the incorrect panel with the expected call on a miss', async () => {
    checkConformance.mockResolvedValue({
      conformant: false, expected_call: '2C', expected_meaning: 'Stayman', situation_id: 'resp-1nt',
    })
    renderPractice()

    fireEvent.click(screen.getByRole('button', { name: '3NT' }))
    fireEvent.click(screen.getByRole('button', { name: 'practice.check' }))

    expect(await screen.findByText('practice.incorrect')).toBeInTheDocument()
  })
})
