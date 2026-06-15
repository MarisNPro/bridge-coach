import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }))
vi.mock('../i18n', () => ({ default: { changeLanguage: vi.fn() } }))

const navigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))

const refreshProfile = vi.fn()
vi.mock('./AuthProvider', () => ({
  useAuth: () => ({
    session: { user: { id: 'u1' } },
    profile: { display_name: 'Ann', locale: 'lv', skill_level: 'beginner' },
    refreshProfile,
  }),
}))

const completeOnboarding = vi.fn()
const redeemCoachCode = vi.fn()
vi.mock('../lib/onboarding', () => ({
  completeOnboarding: (...a) => completeOnboarding(...a),
  redeemCoachCode: (...a) => redeemCoachCode(...a),
}))

import Onboarding from './Onboarding'

const advanceToFinish = () => {
  fireEvent.click(screen.getByRole('button', { name: 'onboarding.next' })) // step 0 -> 1
  fireEvent.click(screen.getByRole('button', { name: 'onboarding.next' })) // step 1 -> 2
  fireEvent.click(screen.getByRole('button', { name: 'onboarding.skip' })) // step 2 -> 3
}

describe('Onboarding', () => {
  beforeEach(() => vi.clearAllMocks())

  it('blocks finish until terms are accepted', async () => {
    render(<Onboarding />)
    advanceToFinish()
    fireEvent.click(screen.getByRole('button', { name: 'onboarding.finish' }))
    expect(await screen.findByText('onboarding.termsRequired')).toBeInTheDocument()
    expect(completeOnboarding).not.toHaveBeenCalled()
  })

  it('saves the profile and navigates home on finish', async () => {
    completeOnboarding.mockResolvedValue()
    render(<Onboarding />)
    advanceToFinish()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'onboarding.finish' }))

    await waitFor(() => expect(completeOnboarding).toHaveBeenCalledWith('u1', {
      displayName: 'Ann', locale: 'lv', skillLevel: 'beginner',
    }))
    expect(redeemCoachCode).not.toHaveBeenCalled()
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/', { replace: true }))
  })

  it('redeems a coach code when one is entered', async () => {
    completeOnboarding.mockResolvedValue()
    redeemCoachCode.mockResolvedValue('Coach Bob')
    render(<Onboarding />)

    fireEvent.click(screen.getByRole('button', { name: 'onboarding.next' })) // -> skill
    fireEvent.click(screen.getByRole('button', { name: 'onboarding.next' })) // -> code
    fireEvent.change(screen.getByLabelText('onboarding.codeLabel'), { target: { value: 'ABC123' } })
    fireEvent.click(screen.getByRole('button', { name: 'onboarding.next' })) // -> terms
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'onboarding.finish' }))

    await waitFor(() => expect(redeemCoachCode).toHaveBeenCalledWith('ABC123'))
    await waitFor(() => expect(completeOnboarding).toHaveBeenCalled())
  })

  it('stops on an invalid coach code and shows the error', async () => {
    redeemCoachCode.mockRejectedValue(new Error('invalid code'))
    render(<Onboarding />)

    fireEvent.click(screen.getByRole('button', { name: 'onboarding.next' }))
    fireEvent.click(screen.getByRole('button', { name: 'onboarding.next' }))
    fireEvent.change(screen.getByLabelText('onboarding.codeLabel'), { target: { value: 'BAD' } })
    fireEvent.click(screen.getByRole('button', { name: 'onboarding.next' }))
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'onboarding.finish' }))

    expect(await screen.findByText('onboarding.codeInvalid')).toBeInTheDocument()
    expect(completeOnboarding).not.toHaveBeenCalled()
  })
})
