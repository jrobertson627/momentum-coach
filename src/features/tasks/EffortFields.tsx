import { useId } from 'react'
import { Segmented } from '../../components/ui/Segmented'
import { ENERGY_LABELS, IMPORTANCE_LABELS, type Energy } from '../../lib/tasks'

const MINUTE_PRESETS = [10, 25, 45, 60]

type Props = {
  /** Kept as text so the number field can be cleared while typing. */
  minutes: string
  onMinutesChange: (minutes: string) => void
  energy: Energy
  onEnergyChange: (energy: Energy) => void
  importance: number
  onImportanceChange: (importance: number) => void
  minutesLabel?: string
}

/** Time, energy and importance: the inputs the engine scores tasks by. */
export function EffortFields({
  minutes,
  onMinutesChange,
  energy,
  onEnergyChange,
  importance,
  onImportanceChange,
  minutesLabel = 'About how long?',
}: Props) {
  const id = useId()

  return (
    <>
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-minutes`} className="text-sm font-medium">
          {minutesLabel} <span className="font-normal">(minutes)</span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {MINUTE_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-pressed={Number(minutes) === preset}
              onClick={() => onMinutesChange(String(preset))}
              className={
                Number(minutes) === preset
                  ? 'rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground'
                  : 'rounded-full border border-border px-3 py-1 text-sm text-muted-foreground hover:text-foreground'
              }
            >
              {preset}
            </button>
          ))}
          <input
            id={`${id}-minutes`}
            type="number"
            inputMode="numeric"
            required
            min={1}
            max={600}
            value={minutes}
            onChange={(e) => onMinutesChange(e.target.value)}
            className="w-24 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
      </div>

      <Segmented
        legend="Energy needed"
        value={energy}
        onChange={onEnergyChange}
        options={(['low', 'medium', 'high'] as const).map((value) => ({
          value,
          label: ENERGY_LABELS[value].replace(' energy', ''),
        }))}
      />

      <Segmented
        legend="Importance"
        value={importance}
        onChange={onImportanceChange}
        options={[1, 2, 3].map((value) => ({
          value,
          label: IMPORTANCE_LABELS[value],
        }))}
      />
    </>
  )
}
