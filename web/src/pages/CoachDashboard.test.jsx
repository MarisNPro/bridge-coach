import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'

vi.mock('react-i18next', () => {
  const t = (k) => k
  return { useTranslation: () => ({ t }) }
})
vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ profile: { role: 'coach', display_name: 'Coach C' }, signOut: () => {}, savePrefs: () => {} }),
}))
vi.mock('../lib/coach', () => ({
  fetchRoster: vi.fn(() => Promise.resolve([
    { student_id: 'abc12345', display_name: 'Alice', solved: 3, total: 5, last_attempt: null },
  ])),
  fetchStudentAttempts: vi.fn(() => Promise.resolve([])),
}))
vi.mock('../lib/assignments', () => ({
  fetchCoachAssignments: vi.fn(() => Promise.resolve([])),
  createAssignment: vi.fn(),
  deleteAssignment: vi.fn(),
}))

import CoachDashboard from './CoachDashboard'

describe('CoachDashboard', () => {
  it('renders the coach roster from the server', async () => {
    renderWithProviders(<CoachDashboard />)
    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('coach.title')).toBeInTheDocument()
  })
})
