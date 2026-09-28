/**
 * Repeating tasks: the patterns, how they read, and when the next one is due.
 *
 * Pure (no Supabase import). The database stores a pattern as JSON in
 * tasks.repeat and checks its shape; the next date is always worked out here
 * and passed to act_on_task, so there is one implementation to test.
 *
 * No pile-up: a repeating task is a single row. Finishing it hides it until
 * its next date; missed days are simply skipped over.
 */

/** 0 = Sunday … 6 = Saturday, like Date.getDay(). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type Repeat =
  | { kind: 'daily' }
  | { kind: 'weekdays'; days: Weekday[] }
  | { kind: 'interval'; every: number; unit: 'day' | 'week' }
  | { kind: 'monthly'; day: number }

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Reads a stored pattern, or null if there isn't a valid one. */
export function parseRepeat(value: unknown): Repeat | null {
  if (!value || typeof value !== 'object') return null
  const r = value as Record<string, unknown>
  switch (r.kind) {
    case 'daily':
      return { kind: 'daily' }
    case 'weekdays': {
      const days = Array.isArray(r.days)
        ? [...new Set(r.days)].filter(
            (d): d is Weekday => Number.isInteger(d) && d >= 0 && d <= 6,
          )
        : []
      return days.length ? { kind: 'weekdays', days: days.sort() } : null
    }
    case 'interval': {
      const every = Number(r.every)
      if (!Number.isInteger(every) || every < 1 || every > 365) return null
      if (r.unit !== 'day' && r.unit !== 'week') return null
      return { kind: 'interval', every, unit: r.unit }
    }
    case 'monthly': {
      const day = Number(r.day)
      if (!Number.isInteger(day) || day < 1 || day > 31) return null
      return { kind: 'monthly', day }
    }
    default:
      return null
  }
}

function ordinal(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}

/** e.g. "Repeats daily", "Repeats Mon, Wed, Fri", "Repeats every 2 weeks". */
export function describeRepeat(repeat: Repeat): string {
  switch (repeat.kind) {
    case 'daily':
      return 'Repeats daily'
    case 'weekdays':
      if (repeat.days.length === 7) return 'Repeats daily'
      if (repeat.days.join() === '1,2,3,4,5') return 'Repeats on weekdays'
      if (repeat.days.join() === '0,6') return 'Repeats on weekends'
      return `Repeats ${repeat.days.map((d) => WEEKDAY_SHORT[d]).join(', ')}`
    case 'interval': {
      const unit = repeat.unit === 'day' ? 'day' : 'week'
      return repeat.every === 1
        ? `Repeats every ${unit}`
        : `Repeats every ${repeat.every} ${unit}s`
    }
    case 'monthly':
      return `Repeats monthly on the ${ordinal(repeat.day)}`
  }
}

function localMidnight(year: number, month: number, day: number): Date {
  return new Date(year, month, day)
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

/**
 * The next time a repeating task comes back: local midnight of the first
 * matching day strictly after `after`'s date. Finishing a daily task today
 * brings it back tomorrow, whatever time it is.
 */
export function nextOccurrence(repeat: Repeat, after: Date): Date {
  const y = after.getFullYear()
  const m = after.getMonth()
  const d = after.getDate()

  switch (repeat.kind) {
    case 'daily':
      return localMidnight(y, m, d + 1)

    case 'weekdays': {
      for (let offset = 1; offset <= 7; offset++) {
        const candidate = localMidnight(y, m, d + offset)
        if (repeat.days.includes(candidate.getDay() as Weekday)) {
          return candidate
        }
      }
      // Unreachable for a valid pattern; fall back to a week later.
      return localMidnight(y, m, d + 7)
    }

    case 'interval': {
      const days = repeat.unit === 'week' ? repeat.every * 7 : repeat.every
      return localMidnight(y, m, d + days)
    }

    case 'monthly': {
      // This month's date if it's still ahead, otherwise next month's. Short
      // months use their last day (e.g. the 31st → Feb 28).
      const thisMonth = Math.min(repeat.day, daysInMonth(y, m))
      if (thisMonth > d) return localMidnight(y, m, thisMonth)
      const nextYear = m === 11 ? y + 1 : y
      const nextMonth = (m + 1) % 12
      return localMidnight(
        nextYear,
        nextMonth,
        Math.min(repeat.day, daysInMonth(nextYear, nextMonth)),
      )
    }
  }
}
