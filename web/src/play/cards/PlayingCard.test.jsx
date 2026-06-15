import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsProvider } from '@/lib/settings'
import PlayingCard from './PlayingCard'

const wrap = (ui) => render(<SettingsProvider>{ui}</SettingsProvider>)

describe('PlayingCard', () => {
  it('labels the card for screen readers and shows ten as 10', () => {
    wrap(<PlayingCard card="HT" variant="minimalist" />)
    expect(screen.getByLabelText('Ten of hearts')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('renders a center suit glyph in the minimalist style', () => {
    wrap(<PlayingCard card="SA" variant="minimalist" />)
    // corner index (♠) + large center glyph (♠) = two spade symbols
    expect(screen.getAllByText('♠')).toHaveLength(2)
  })

  it('renders pip count for spot cards in the illustrative style', () => {
    wrap(<PlayingCard card="D5" variant="illustrative" />)
    // 2 corner indices + 5 center pips
    expect(screen.getAllByText('♦')).toHaveLength(7)
  })

  it('is a button that plays when given onPlay and not disabled', async () => {
    const onPlay = vi.fn()
    wrap(<PlayingCard card="CK" onPlay={onPlay} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onPlay).toHaveBeenCalledWith('CK')
  })

  it('does not fire when disabled', async () => {
    const onPlay = vi.fn()
    wrap(<PlayingCard card="CK" onPlay={onPlay} disabled />)
    await userEvent.click(screen.getByRole('button'))
    expect(onPlay).not.toHaveBeenCalled()
  })

  it('renders a non-interactive card-back when face down', () => {
    const { container } = wrap(<PlayingCard card="CK" faceDown />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(container.querySelector('.card-back')).toBeTruthy()
  })
})
