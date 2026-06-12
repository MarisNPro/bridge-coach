import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsProvider } from '@/lib/settings'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }))
vi.mock('../lib/engine', () => ({
  getSystem: vi.fn(() => Promise.resolve({
    id: 'natural-v1', name: 'Natural', situations: 71, rules: 471,
    toggles: { open_min_hcp: 12, nt_range: { min: 15, max: 17 }, weak2_range: { min: 6, max: 10 }, nt_with_5card_major: true },
  })),
}))

import SystemReference from './SystemReference'

const renderRef = () => render(<SettingsProvider><SystemReference /></SettingsProvider>)

describe('SystemReference', () => {
  beforeEach(() => localStorage.clear())

  it('renders the system name and its toggles once loaded', async () => {
    renderRef()
    expect(await screen.findByText('Natural')).toBeInTheDocument()
    expect(screen.getByText('15-17')).toBeInTheDocument()   // NT range
    expect(screen.getByText('6-10')).toBeInTheDocument()    // weak-2 range (default preset)
    expect(screen.getByText('12+')).toBeInTheDocument()     // opening minimum
  })

  it('changing the weak-2 preset updates the shown range and persists it', async () => {
    renderRef()
    await screen.findByText('Natural')
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'aggressive' } })
    expect(await screen.findByText('5-11')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('bc.settings')).weak2).toBe('aggressive')
  })

  it('renders nothing until the system loads', () => {
    const { container } = renderRef()
    expect(container.querySelector('h3')).toBeNull()
  })
})
