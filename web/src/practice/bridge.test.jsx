import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SettingsProvider } from '@/lib/settings'
import { Hand, Call } from './bridge'

const wrap = (ui) => render(<SettingsProvider>{ui}</SettingsProvider>)

describe('bridge rendering', () => {
  it('renders a hand with suit symbols and shows ten as 10', () => {
    wrap(<Hand hand="AKQ.JT.987.6543" />)
    expect(screen.getByText('♠')).toBeInTheDocument()
    expect(screen.getByText('A K Q')).toBeInTheDocument()
    expect(screen.getByText('J 10')).toBeInTheDocument()
  })

  it('renders a notrump call', () => {
    wrap(<Call value="1NT" />)
    expect(screen.getByText('NT')).toBeInTheDocument()
  })

  it('renders Pass and Double labels', () => {
    const { rerender } = wrap(<Call value="Pass" />)
    expect(screen.getByText('Pass')).toBeInTheDocument()
    rerender(<SettingsProvider><Call value="X" /></SettingsProvider>)
    expect(screen.getByText('Dbl')).toBeInTheDocument()
  })
})
