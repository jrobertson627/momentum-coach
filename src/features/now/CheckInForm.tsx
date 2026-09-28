import clsx from 'clsx'
import { useId, useState } from 'react'
import { ENERGY_OPTIONS, TIME_OPTIONS, type CheckIn } from '../../lib/checkIn'
import type { Energy } from '../../lib/tasks'

type Props = {
  initial?: CheckIn | null
  onSubmit: (checkIn: CheckIn) => void
}

/**
 * Two taps: time, then energy. As soon as both are chosen it submits, so a
 * check-in takes a couple of seconds on a phone.
 */
export function CheckInForm({ initial, onSubmit }: Props) {
  const [minutes, setMinutes] = useState<number | null>(
    initial?.minutes ?? null,
  )
  const [energy, setEnergy] = useState<Energy | null>(initial?.energy ?? null)

  function choose(next: { minutes?: number; energy?: Energy }) {
    const m = next.minutes ?? minutes
    const e = next.energy ?? energy
    setMinutes(m)
    setEnergy(e)
    if (m !== null && e !== null) onSubmit({ minutes: m, energy: e })
  }

  return (
    <div className="grid gap-6">
      <ChipGroup
        legend="How much time do you have?"
        options={TIME_OPTIONS.map((o) => ({
          value: o.minutes,
          label: o.label,
        }))}
        value={minutes}
        onChange={(m) => choose({ minutes: m })}
      />
      <ChipGroup
        legend="How’s your energy?"
        options={ENERGY_OPTIONS.map((o) => ({
          value: o.energy,
          label: o.label,
        }))}
        value={energy}
        onChange={(e) => choose({ energy: e })}
      />
    </div>
  )
}

function ChipGroup<T extends string | number>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string
  options: { value: T; label: string }[]
  value: T | null
  onChange: (value: T) => void
}) {
  const name = useId()

  return (
    <fieldset className="grid gap-3">
      <legend className="mb-3 font-serif text-xl font-semibold">
        {legend}
      </legend>
      <div
        className={clsx(
          'grid gap-2 sm:grid-flow-col sm:grid-cols-none',
          options.length === 3 ? 'grid-cols-3' : 'grid-cols-2',
        )}
      >
        {options.map((option) => {
          const checked = option.value === value
          return (
            <label
              key={option.value}
              className={clsx(
                'flex min-h-14 cursor-pointer items-center justify-center rounded-lg border px-4 text-base font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent',
                checked
                  ? 'border-accent bg-accent text-accent-foreground'
                  : 'border-border bg-muted text-foreground shadow-sm hover:border-accent/50',
              )}
            >
              <input
                type="radio"
                name={name}
                className="sr-only"
                checked={checked}
                onChange={() => onChange(option.value)}
              />
              {option.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
