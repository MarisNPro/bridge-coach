import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('react-i18next', () => {
  const t = (k) => k
  return { useTranslation: () => ({ t }) }
})
vi.mock('../lib/supabase', () => ({ supabase: { auth: { signInWithOtp: vi.fn() } } }))
vi.mock('./AuthProvider', () => ({ useAuth: () => ({ signInWithGoogle: vi.fn() }) }))

import { supabase } from '../lib/supabase'
import Login from './Login'

describe('Login', () => {
  beforeEach(() => vi.clearAllMocks())

  it('signs up: sends a magic link carrying the profile metadata', async () => {
    supabase.auth.signInWithOtp.mockResolvedValue({ error: null })
    render(<Login />) // defaults to sign-up mode

    fireEvent.change(screen.getByLabelText('auth.email'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('auth.nickname'), { target: { value: 'Ann' } })
    fireEvent.click(screen.getByRole('checkbox')) // accept terms
    fireEvent.click(screen.getByRole('button', { name: 'auth.agreeAndContinue' }))

    await waitFor(() => expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'a@b.com',
      options: { data: { display_name: 'Ann', skill_level: 'beginner', terms_accepted: 'true', locale: 'lv' } },
    }))
    expect(await screen.findByText('auth.checkEmail')).toBeInTheDocument()
  })

  it('blocks sign-up until the terms are accepted', async () => {
    render(<Login />)
    fireEvent.change(screen.getByLabelText('auth.email'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('auth.nickname'), { target: { value: 'Ann' } })
    fireEvent.click(screen.getByRole('button', { name: 'auth.agreeAndContinue' }))

    expect(await screen.findByText('onboarding.termsRequired')).toBeInTheDocument()
    expect(supabase.auth.signInWithOtp).not.toHaveBeenCalled()
  })

  it('sign-in mode does not create an account (shouldCreateUser: false)', async () => {
    supabase.auth.signInWithOtp.mockResolvedValue({ error: null })
    render(<Login />)

    fireEvent.click(screen.getByRole('button', { name: 'auth.signIn' })) // switch to sign-in
    fireEvent.change(screen.getByLabelText('auth.email'), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'auth.signIn' })) // submit

    await waitFor(() => expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'a@b.com', options: { shouldCreateUser: false },
    }))
    expect(await screen.findByText('auth.checkEmail')).toBeInTheDocument()
  })

  it('surfaces an auth error inline (no alert)', async () => {
    supabase.auth.signInWithOtp.mockResolvedValue({ error: { message: 'rate limited' } })
    render(<Login />)

    fireEvent.change(screen.getByLabelText('auth.email'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('auth.nickname'), { target: { value: 'Ann' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'auth.agreeAndContinue' }))

    expect(await screen.findByText('rate limited')).toBeInTheDocument()
  })
})
