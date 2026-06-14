import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }))
vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ profile: { role: 'superadmin', display_name: 'Admin' }, signOut: () => {}, savePrefs: () => {} }),
}))
vi.mock('../lib/admin', () => ({
  fetchUsers: vi.fn(() => Promise.resolve([
    { id: 'u1', email: 'coach@x.io', display_name: 'Coach', role: 'coach' },
    { id: 'u2', email: 'stu@x.io', display_name: 'Stu', role: 'student' },
  ])),
  fetchLinks: vi.fn(() => Promise.resolve([
    { coach_id: 'u1', student_id: 'u2', coach_name: 'Coach', student_name: 'Stu' },
  ])),
  setRole: vi.fn(() => Promise.resolve()),
  linkCoachStudent: vi.fn(() => Promise.resolve()),
  unlinkCoachStudent: vi.fn(() => Promise.resolve()),
}))

import SuperadminDashboard from './SuperadminDashboard'
import { setRole, unlinkCoachStudent } from '../lib/admin'

beforeEach(() => { setRole.mockClear(); unlinkCoachStudent.mockClear() })

describe('SuperadminDashboard', () => {
  it('lists users and lets the admin change a role', async () => {
    renderWithProviders(<SuperadminDashboard />)
    expect(await screen.findByText('coach@x.io')).toBeInTheDocument()
    // First role <select> is the first user's; promote/demote it.
    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: 'student' } })
    await waitFor(() => expect(setRole).toHaveBeenCalledWith('u1', 'student'))
  })

  it('unlinks a coach↔student pair', async () => {
    renderWithProviders(<SuperadminDashboard />)
    await screen.findByText('coach@x.io')
    fireEvent.click(screen.getByRole('button', { name: 'assign.delete' }))
    await waitFor(() => expect(unlinkCoachStudent).toHaveBeenCalledWith('u1', 'u2'))
  })
})
