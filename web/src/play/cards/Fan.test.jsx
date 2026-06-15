import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsProvider } from '@/lib/settings'
import Fan from './Fan'

const wrap = (ui) => render(<SettingsProvider>{ui}</SettingsProvider>)

describe('Fan', () => {
  it('plays only legal cards and ignores illegal ones', async () => {
    const onPlay = vi.fn()
    const cards = ['SA', 'SK', 'H7']
    wrap(<Fan cards={cards} legal={new Set(['SA', 'H7'])} onPlay={onPlay} />)

    await userEvent.click(screen.getByLabelText('Ace of spades'))
    await userEvent.click(screen.getByLabelText('King of spades')) // illegal
    await userEvent.click(screen.getByLabelText('Seven of hearts'))

    expect(onPlay.mock.calls.map((c) => c[0])).toEqual(['SA', 'H7'])
  })

  it('marks best cards with the success ring', () => {
    wrap(<Fan cards={['SA', 'SK']} legal={new Set(['SA', 'SK'])} best={new Set(['SA'])} onPlay={() => {}} />)
    expect(screen.getByLabelText('Ace of spades').className).toContain('ring-success')
    expect(screen.getByLabelText('King of spades').className).not.toContain('ring-success')
  })

  it('renders card-backs and no buttons when face down', () => {
    const { container } = wrap(<Fan cards={['SA', 'SK', 'H7']} faceDown />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(container.querySelectorAll('.card-back')).toHaveLength(3)
  })

  it('shows a dash for an empty hand', () => {
    wrap(<Fan cards={[]} legal={new Set()} onPlay={() => {}} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
