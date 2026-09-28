import clsx from 'clsx'
import { useId, useState } from 'react'
import type { Repeat, Weekday } from '../../lib/repeat'

const WEEKDAYS: { day: Weekday; short: string; name: string }[] = [
  { day: 1, short: 'M', name: 'Monday' },
  { day: 2, short: 'T', name: 'Tuesday' },
  { day: 3, short: 'W', name: 'Wednesday' },
  { day: 4, short: 'T', name: 'Thursday' },
  { day: 5, short: 'F', name: 'Friday' },
  { day: 6, short: 'S', name: 'Saturday' },
  { day: 0, short: 'S', name: 'Sunday' },
]

type Kind = 'none' | Repeat['kind']

const inputClass =
  'rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground'

type Props = {
  value: Repeat | null
  onChange: (repeat: Repeat | null) => void
}

/** "Repeats": never, daily, on certain weekdays, every N days/weeks, monthly. */
export function RepeatField({ value, onChange }: Props) {
  const id = useId()
  const kind: Kind = value?.kind ?? 'none'

  // Remember each pattern's details so switching back and forth keeps them.
  const [days, setDays] = useState<Weekday[]>(
    value?.kind === 'weekdays' ? value.days : [1, 3, 5],
  )
  const [every, setEvery] = useState(
    String(value?.kind === 'interval' ? value.every : 2),
  )
  const [unit, setUnit] = useState<'day' | 'week'>(
    value?.kind === 'interval' ? value.unit : 'day',
  )
  const [monthDay, setMonthDay] = useState(
    String(value?.kind === 'monthly' ? value.day : new Date().getDate()),
  )

  function build(
    next: Kind,
    overrides: Partial<{
      days: Weekday[]
      every: string
      unit: 'day' | 'week'
      monthDay: string
    }> = {},
  ): Repeat | null {
    const d = overrides.days ?? days
    const e = Number(overrides.every ?? every)
    const u = overrides.unit ?? unit
    const md = Number(overrides.monthDay ?? monthDay)
    switch (next) {
      case 'none':
        return null
      case 'daily':
        return { kind: 'daily' }
      case 'weekdays':
        return d.length ? { kind: 'weekdays', days: [...d].sort() } : null
      case 'interval':
        return {
          kind: 'interval',
          every: Math.max(1, Math.min(365, e || 1)),
          unit: u,
        }
      case 'monthly':
        return { kind: 'monthly', day: Math.max(1, Math.min(31, md || 1)) }
    }
  }

  function toggleDay(day: Weekday) {
    const next = days.includes(day)
      ? days.filter((d) => d !== day)
      : [...days, day]
    // Keep at least one day selected.
    if (next.length === 0) return
    setDays(next)
    onChange(build('weekdays', { days: next }))
  }

  return (
    <div className="grid gap-2">
      <label htmlFor={`${id}-kind`} className="text-sm font-medium">
        Repeats
      </label>
      <select
        id={`${id}-kind`}
        value={kind}
        onChange={(e) => onChange(build(e.target.value as Kind))}
        className={`${inputClass} w-full`}
      >
        <option value="none">Never (one-off)</option>
        <option value="daily">Every day</option>
        <option value="weekdays">On certain days</option>
        <option value="interval">Every few days or weeks</option>
        <option value="monthly">Monthly</option>
      </select>

      {kind === 'weekdays' && (
        <div role="group" aria-label="Days" className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map(({ day, short, name }) => {
            const on = days.includes(day)
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                aria-label={name}
                title={name}
                onClick={() => toggleDay(day)}
                className={clsx(
                  'size-9 rounded-full text-sm font-medium',
                  on
                    ? 'bg-accent text-accent-foreground'
                    : 'border border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {short}
              </button>
            )
          })}
        </div>
      )}

      {kind === 'interval' && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor={`${id}-every`}>Every</label>
          <input
            id={`${id}-every`}
            type="number"
            inputMode="numeric"
            min={1}
            max={365}
            value={every}
            onChange={(e) => {
              setEvery(e.target.value)
              onChange(build('interval', { every: e.target.value }))
            }}
            className={`${inputClass} w-20`}
          />
          <label htmlFor={`${id}-unit`} className="sr-only">
            Unit
          </label>
          <select
            id={`${id}-unit`}
            value={unit}
            onChange={(e) => {
              const next = e.target.value as 'day' | 'week'
              setUnit(next)
              onChange(build('interval', { unit: next }))
            }}
            className={inputClass}
          >
            <option value="day">days</option>
            <option value="week">weeks</option>
          </select>
        </div>
      )}

      {kind === 'monthly' && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor={`${id}-day`}>On day</label>
          <input
            id={`${id}-day`}
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            value={monthDay}
            onChange={(e) => {
              setMonthDay(e.target.value)
              onChange(build('monthly', { monthDay: e.target.value }))
            }}
            className={`${inputClass} w-20`}
          />
          <span className="text-muted-foreground">
            of each month (short months use their last day)
          </span>
        </div>
      )}
    </div>
  )
}
