import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }))

const navigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))

const refreshProfile = vi.fn()
vi.mock('./AuthProvider', () => ({
  useAuth: () => ({
    session: { user: { id: 'u1' } },
    profile: { display_name: 'Ann' },
    refreshProfile,
  }),
}))

const markWelcomed = vi.fn()
vi.mock('../lib/onboarding', () => ({ markWelcomed: (...a) => markWelcomed(...a) }))

import Welcome from './Welcome'

describe('Welcome', () => {
  beforeEach(() => vi.clearAllMocks())

  it('marks the user welcomed and navigates home on continue', async () => {
    markWelcomed.mockResolvedValue()
    render(<Welcome />)

    fireEvent.click(screen.getByRole('button', { name: 'welcome.cta' }))

    await waitFor(() => expect(markWelcomed).toHaveBeenCalledWith('u1'))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/', { replace: true }))
  })

  it('still navigates home if the flag write fails', async () => {
    markWelcomed.mockRejectedValue(new Error('offline'))
    render(<Welcome />)

    fireEvent.click(screen.getByRole('button', { name: 'welcome.cta' }))

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/', { replace: true }))
  })
})
