import { describe, expect, it } from 'vitest'
import { creditsFor, formatCredits } from './rewards'

describe('creditsFor', () => {
  it('earns a minute of game time per two minutes of effort, rounding up', () => {
    expect(creditsFor(25)).toBe(13)
    expect(creditsFor(60)).toBe(30)
  })

  it('always earns at least a minute', () => {
    expect(creditsFor(1)).toBe(1)
  })
})

describe('formatCredits', () => {
  it.each([
    [0, '0 min'],
    [45, '45 min'],
    [60, '1 h'],
    [95, '1 h 35 min'],
  ])('%i → %s', (minutes, text) => {
    expect(formatCredits(minutes)).toBe(text)
  })
})
