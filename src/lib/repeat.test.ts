import { describe, expect, it } from 'vitest'
import {
  describeRepeat,
  nextOccurrence,
  parseRepeat,
  type Repeat,
} from './repeat'

// Local-time dates, so tests hold in any time zone. Months are 0-based.
const at = (y: number, m: number, d: number, h = 15) => new Date(y, m, d, h, 30)
const day = (y: number, m: number, d: number) => new Date(y, m, d)

describe('nextOccurrence', () => {
  it('daily: tomorrow at midnight, whatever the time now', () => {
    expect(nextOccurrence({ kind: 'daily' }, at(2026, 8, 28, 23))).toEqual(
      day(2026, 8, 29),
    )
    expect(nextOccurrence({ kind: 'daily' }, at(2026, 11, 31))).toEqual(
      day(2027, 0, 1),
    )
  })

  describe('weekdays', () => {
    const monWedFri: Repeat = { kind: 'weekdays', days: [1, 3, 5] }

    it('picks the next matching weekday', () => {
      // Mon Sep 28 2026 → Wed Sep 30
      expect(nextOccurrence(monWedFri, at(2026, 8, 28))).toEqual(
        day(2026, 8, 30),
      )
      // Tue Sep 29 → Wed Sep 30
      expect(nextOccurrence(monWedFri, at(2026, 8, 29))).toEqual(
        day(2026, 8, 30),
      )
    })

    it('wraps around the weekend', () => {
      // Fri Oct 2 → Mon Oct 5
      expect(nextOccurrence(monWedFri, at(2026, 9, 2))).toEqual(day(2026, 9, 5))
    })

    it('a single weekday comes back a week later', () => {
      const mondays: Repeat = { kind: 'weekdays', days: [1] }
      expect(nextOccurrence(mondays, at(2026, 8, 28))).toEqual(day(2026, 9, 5))
    })
  })

  it('every N days or weeks counts from today', () => {
    expect(
      nextOccurrence(
        { kind: 'interval', every: 3, unit: 'day' },
        at(2026, 8, 30),
      ),
    ).toEqual(day(2026, 9, 3))
    expect(
      nextOccurrence(
        { kind: 'interval', every: 2, unit: 'week' },
        at(2026, 8, 28),
      ),
    ).toEqual(day(2026, 9, 12))
  })

  describe('monthly', () => {
    it('uses this month if the day is still ahead', () => {
      expect(
        nextOccurrence({ kind: 'monthly', day: 30 }, at(2026, 8, 28)),
      ).toEqual(day(2026, 8, 30))
    })

    it('moves to next month once the day has come', () => {
      expect(
        nextOccurrence({ kind: 'monthly', day: 1 }, at(2026, 8, 1)),
      ).toEqual(day(2026, 9, 1))
      expect(
        nextOccurrence({ kind: 'monthly', day: 15 }, at(2026, 11, 20)),
      ).toEqual(day(2027, 0, 15))
    })

    it('short months use their last day', () => {
      // The 31st, from Jan 31 → Feb 28 (2027 isn't a leap year)
      expect(
        nextOccurrence({ kind: 'monthly', day: 31 }, at(2027, 0, 31)),
      ).toEqual(day(2027, 1, 28))
      // Leap year: → Feb 29, 2028
      expect(
        nextOccurrence({ kind: 'monthly', day: 31 }, at(2028, 0, 31)),
      ).toEqual(day(2028, 1, 29))
      // On Feb 28 (its last day), the 30th → Mar 30
      expect(
        nextOccurrence({ kind: 'monthly', day: 30 }, at(2027, 1, 28)),
      ).toEqual(day(2027, 2, 30))
    })
  })

  it('is always after today', () => {
    const patterns: Repeat[] = [
      { kind: 'daily' },
      { kind: 'weekdays', days: [0, 1, 2, 3, 4, 5, 6] },
      { kind: 'interval', every: 1, unit: 'day' },
      { kind: 'monthly', day: 28 },
    ]
    const now = at(2026, 1, 28, 0)
    for (const pattern of patterns) {
      expect(nextOccurrence(pattern, now).getTime()).toBeGreaterThan(
        day(2026, 1, 28).getTime(),
      )
    }
  })
})

describe('describeRepeat', () => {
  it.each<[Repeat, string]>([
    [{ kind: 'daily' }, 'Repeats daily'],
    [{ kind: 'weekdays', days: [1, 3, 5] }, 'Repeats Mon, Wed, Fri'],
    [{ kind: 'weekdays', days: [1, 2, 3, 4, 5] }, 'Repeats on weekdays'],
    [{ kind: 'weekdays', days: [0, 6] }, 'Repeats on weekends'],
    [{ kind: 'interval', every: 1, unit: 'week' }, 'Repeats every week'],
    [{ kind: 'interval', every: 3, unit: 'day' }, 'Repeats every 3 days'],
    [{ kind: 'monthly', day: 1 }, 'Repeats monthly on the 1st'],
    [{ kind: 'monthly', day: 22 }, 'Repeats monthly on the 22nd'],
    [{ kind: 'monthly', day: 13 }, 'Repeats monthly on the 13th'],
  ])('%j → %s', (repeat, text) => {
    expect(describeRepeat(repeat)).toBe(text)
  })
})

describe('parseRepeat', () => {
  it('accepts valid patterns and tidies weekdays', () => {
    expect(parseRepeat({ kind: 'weekdays', days: [5, 1, 1, 3] })).toEqual({
      kind: 'weekdays',
      days: [1, 3, 5],
    })
    expect(parseRepeat({ kind: 'interval', every: 2, unit: 'week' })).toEqual({
      kind: 'interval',
      every: 2,
      unit: 'week',
    })
  })

  it('rejects anything malformed', () => {
    for (const bad of [
      null,
      'daily',
      { kind: 'yearly' },
      { kind: 'weekdays', days: [] },
      { kind: 'weekdays', days: [7] },
      { kind: 'interval', every: 0, unit: 'day' },
      { kind: 'interval', every: 2, unit: 'month' },
      { kind: 'monthly', day: 32 },
    ]) {
      expect(parseRepeat(bad)).toBeNull()
    }
  })
})
