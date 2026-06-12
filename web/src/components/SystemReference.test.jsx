import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }))
vi.mock('../lib/engine', () => ({
  getSystem: vi.fn(() => Promise.resolve({
    id: 'natural-v1', name: 'Natural', situations: 71, rules: 471,
    toggles: { open_min_hcp: 12, nt_range: { min: 15, max: 17 }, weak2_range: { min: 6, max: 10 }, nt_with_5card_major: true },
  })),
}))

import SystemReference from './SystemReference'

describe('SystemReference', () => {
  it('renders the system name and its toggles once loaded', async () => {
    render(<SystemReference />)
    expect(await screen.findByText('Natural')).toBeInTheDocument()
    expect(screen.getByText('15-17')).toBeInTheDocument()   // NT range
    expect(screen.getByText('6-10')).toBeInTheDocument()    // weak-2 range
    expect(screen.getByText('12+')).toBeInTheDocument()     // opening minimum
  })

  it('renders nothing until the system loads', () => {
    // First paint is null (no system yet) — title appears only after the fetch.
    const { container } = render(<SystemReference />)
    expect(container.querySelector('h3')).toBeNull()
  })
})
