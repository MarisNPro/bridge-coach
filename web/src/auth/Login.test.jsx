import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('react-i18next', () => {
  const t = (k) => k
  return { useTranslation: () => ({ t }) }
})
vi.mock('../lib/supabase', () => ({ supabase: { auth: { signInWithOtp: vi.fn() } } }))

import { supabase } from '../lib/supabase'
import Login from './Login'

describe('Login', () => {
  it('sends a magic link and shows the check-email state', async () => {
    supabase.auth.signInWithOtp.mockResolvedValue({ error: null })
    render(<Login />)

    fireEvent.change(screen.getByLabelText('auth.email'), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'auth.signIn' }))

    await waitFor(() => expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({ email: 'a@b.com' }))
    expect(await screen.findByText('auth.checkEmail')).toBeInTheDocument()
  })

  it('surfaces an auth error inline (no alert)', async () => {
    supabase.auth.signInWithOtp.mockResolvedValue({ error: { message: 'rate limited' } })
    render(<Login />)

    fireEvent.change(screen.getByLabelText('auth.email'), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'auth.signIn' }))

    expect(await screen.findByText('rate limited')).toBeInTheDocument()
  })
})
