import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k, o) => (o?.name ? `${k}:${o.name}` : k) }),
}))

const getMyCoach = vi.fn()
const redeemCoachCode = vi.fn()
vi.mock('@/lib/onboarding', () => ({
  getMyCoach: (...a) => getMyCoach(...a),
  redeemCoachCode: (...a) => redeemCoachCode(...a),
}))

import CoachLink from './CoachLink'

describe('CoachLink', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the linked coach when already connected', async () => {
    getMyCoach.mockResolvedValue('Coach Bob')
    render(<CoachLink />)
    expect(await screen.findByText('settings.coachLinked:Coach Bob')).toBeInTheDocument()
  })

  it('links with a code and then shows the coach', async () => {
    getMyCoach.mockResolvedValue(null)
    redeemCoachCode.mockResolvedValue('Coach Bob')
    render(<CoachLink />)

    fireEvent.change(screen.getByLabelText('settings.coachLinkLabel'), { target: { value: 'abc123' } })
    fireEvent.click(screen.getByRole('button', { name: 'settings.coachLinkBtn' }))

    await waitFor(() => expect(redeemCoachCode).toHaveBeenCalledWith('abc123'))
    expect(await screen.findByText('settings.coachLinked:Coach Bob')).toBeInTheDocument()
  })

  it('maps an invalid code to the error message', async () => {
    getMyCoach.mockResolvedValue(null)
    redeemCoachCode.mockRejectedValue(new Error('invalid code'))
    render(<CoachLink />)

    fireEvent.change(screen.getByLabelText('settings.coachLinkLabel'), { target: { value: 'nope' } })
    fireEvent.click(screen.getByRole('button', { name: 'settings.coachLinkBtn' }))

    expect(await screen.findByText('settings.coachInvalid')).toBeInTheDocument()
  })
})
