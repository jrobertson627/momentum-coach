import { useId, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { startOfDate, startOfDayIn, type TaskAction } from '../../lib/actions'

type Props = {
  pending: boolean
  onAct: (action: TaskAction) => void
}

/** Done / Skip / Later for the recommended task. */
export function PickActions({ pending, onAct }: Props) {
  const id = useId()
  const [choosingLater, setChoosingLater] = useState(false)
  const [date, setDate] = useState('')

  if (choosingLater) {
    const tomorrow = startOfDayIn(1)
    const minDate = [
      tomorrow.getFullYear(),
      String(tomorrow.getMonth() + 1).padStart(2, '0'),
      String(tomorrow.getDate()).padStart(2, '0'),
    ].join('-')

    return (
      <div className="grid gap-3 rounded-md border border-border bg-background p-3">
        <p className="text-sm font-medium">Come back to this…</p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => onAct({ kind: 'deferred', until: startOfDayIn(1) })}
          >
            Tomorrow
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => onAct({ kind: 'deferred', until: startOfDayIn(7) })}
          >
            Next week
          </Button>
        </div>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (date) onAct({ kind: 'deferred', until: startOfDate(date) })
          }}
        >
          <label htmlFor={`${id}-date`} className="text-sm">
            On
          </label>
          <input
            id={`${id}-date`}
            type="date"
            min={minDate}
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
          <Button size="sm" type="submit" disabled={pending || !date}>
            Set
          </Button>
          <Button
            size="sm"
            type="button"
            variant="ghost"
            onClick={() => setChoosingLater(false)}
          >
            Cancel
          </Button>
        </form>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button disabled={pending} onClick={() => onAct({ kind: 'completed' })}>
        Done
      </Button>
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() => onAct({ kind: 'skipped' })}
      >
        Skip
      </Button>
      <Button
        variant="ghost"
        disabled={pending}
        onClick={() => setChoosingLater(true)}
      >
        Later
      </Button>
    </div>
  )
}
