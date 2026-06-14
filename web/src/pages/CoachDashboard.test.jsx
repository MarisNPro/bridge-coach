import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }))
vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ profile: { role: 'coach', display_name: 'Coach C' }, signOut: () => {}, savePrefs: () => {} }),
}))
vi.mock('../lib/coach', () => ({
  fetchRoster: vi.fn(() => Promise.resolve([
    { student_id: 'abc12345', display_name: 'Alice', solved: 3, total: 5, last_attempt: null },
  ])),
  fetchStudentAttempts: vi.fn(() => Promise.resolve([
    { conformant: true, deal_id: 'opening', your_call: '1NT', expected_call: null, created_at: '2026-06-01' },
  ])),
}))
vi.mock('../lib/assignments', () => ({
  fetchCoachAssignments: vi.fn(() => Promise.resolve([
    { id: 'a1', student_id: 'abc12345', situation: 'opening', solved: 0, target: 10 },
  ])),
  createAssignment: vi.fn(() => Promise.resolve()),
  deleteAssignment: vi.fn(() => Promise.resolve()),
}))
vi.mock('../lib/engine', () => ({
  getSystem: vi.fn(() => Promise.resolve({ id: 'natural-v1', name: 'Natural', situations: 71, rules: 471, toggles: {} })),
}))

import CoachDashboard from './CoachDashboard'
import { fetchStudentAttempts } from '../lib/coach'
import { createAssignment, deleteAssignment } from '../lib/assignments'

beforeEach(() => { fetchStudentAttempts.mockClear(); createAssignment.mockClear(); deleteAssignment.mockClear() })

describe('CoachDashboard', () => {
  it('renders the coach roster from the server', async () => {
    renderWithProviders(<CoachDashboard />)
    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('coach.title')).toBeInTheDocument()
  })

  it('expanding a student loads their recent attempts', async () => {
    renderWithProviders(<CoachDashboard />)
    fireEvent.click(await screen.findByText('Alice'))
    await waitFor(() => expect(fetchStudentAttempts).toHaveBeenCalledWith('abc12345'))
  })

  it('assigns a situation to a student', async () => {
    renderWithProviders(<CoachDashboard />)
    fireEvent.click(await screen.findByText('Alice'))
    fireEvent.click(await screen.findByRole('button', { name: 'assign.assignBtn' }))
    await waitFor(() => expect(createAssignment).toHaveBeenCalledWith(
      expect.objectContaining({ student_id: 'abc12345', target: 10 })))
  })

  it('deletes an existing assignment', async () => {
    renderWithProviders(<CoachDashboard />)
    fireEvent.click(await screen.findByText('Alice'))
    fireEvent.click(await screen.findByRole('button', { name: 'assign.delete' }))
    await waitFor(() => expect(deleteAssignment).toHaveBeenCalledWith('a1'))
  })
})
