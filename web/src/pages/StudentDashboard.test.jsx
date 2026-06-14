import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }))
vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ profile: { role: 'student', display_name: 'Stu' }, signOut: () => {}, savePrefs: () => {} }),
}))
vi.mock('../lib/assignments', () => ({
  fetchStudentAssignments: vi.fn(() => Promise.resolve([
    { id: 'a1', situation: 'opening', solved: 2, target: 10 },
  ])),
}))
// Stub the heavy practice screen; this test is about the assignments panel.
vi.mock('../practice/BidPractice', () => ({ default: ({ only }) => <div data-testid="practice">{String(only)}</div> }))

import StudentDashboard from './StudentDashboard'

describe('StudentDashboard', () => {
  it('shows coach assignments and focuses practice on one', async () => {
    renderWithProviders(<StudentDashboard />)
    expect(await screen.findByText('assign.fromCoach')).toBeInTheDocument()
    expect(screen.getByTestId('practice')).toHaveTextContent('null')   // random by default

    fireEvent.click(screen.getByRole('button', { name: 'assign.practice' }))
    expect(screen.getByText('assign.focused')).toBeInTheDocument()      // focus banner
    expect(screen.getByTestId('practice')).toHaveTextContent('opening') // focused situation
  })
})
