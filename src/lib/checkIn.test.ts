import { describe, expect, it } from 'vitest'
import { describeCheckIn, PLENTY_OF_TIME } from './checkIn'

describe('describeCheckIn', () => {
  it('reads naturally', () => {
    expect(describeCheckIn({ minutes: 25, energy: 'low' })).toBe(
      '25 minutes and low energy',
    )
    expect(describeCheckIn({ minutes: PLENTY_OF_TIME, energy: 'high' })).toBe(
      'an hour or more and high energy',
    )
  })
})
