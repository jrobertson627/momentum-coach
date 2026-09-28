import { describe, expect, it } from 'vitest'
import { startOfDate, startOfDayIn } from './actions'

describe('startOfDayIn', () => {
  it('is local midnight the given number of days later', () => {
    const now = new Date(2026, 8, 28, 15, 42) // Sep 28, 3:42 pm local
    expect(startOfDayIn(1, now)).toEqual(new Date(2026, 8, 29))
    expect(startOfDayIn(7, now)).toEqual(new Date(2026, 9, 5))
  })

  it('does not change the date passed in', () => {
    const now = new Date(2026, 8, 28, 15, 42)
    startOfDayIn(1, now)
    expect(now).toEqual(new Date(2026, 8, 28, 15, 42))
  })
})

describe('startOfDate', () => {
  it('parses a date input value as local midnight', () => {
    expect(startOfDate('2026-10-03')).toEqual(new Date(2026, 9, 3))
  })
})
