import { useId, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { parseTaskLines, type Energy } from '../../lib/tasks'
import { EffortFields } from './EffortFields'
import { useCreateTasks } from './useTasks'

type Props = {
  /** The section's project, or null for chores. */
  projectId: string | null
  projectName?: string
  onDone: (added: number) => void
}

/**
 * Several tasks at once, one per line, sharing the same time, energy and
 * importance. Each can be fine-tuned afterwards with Edit.
 */
export function BulkAddForm({ projectId, projectName, onDone }: Props) {
  const id = useId()
  const create = useCreateTasks()
  const [text, setText] = useState('')
  const [minutes, setMinutes] = useState('25')
  const [energy, setEnergy] = useState<Energy>('medium')
  const [importance, setImportance] = useState(2)

  const titles = parseTaskLines(text)
  const count = titles.length

  function submit(e: FormEvent) {
    e.preventDefault()
    if (count === 0) return
    create.mutate(
      titles.map((title) => ({
        title,
        project_id: projectId,
        estimated_minutes: Number(minutes),
        energy,
        importance,
      })),
      { onSuccess: () => onDone(count) },
    )
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-lines`} className="text-sm font-medium">
          {projectName ? `Tasks for ${projectName}` : 'Chores & obligations'}
        </label>
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          One per line. Pasting a list from your notes works too.
        </p>
        <textarea
          id={`${id}-lines`}
          aria-describedby={`${id}-hint`}
          autoFocus
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            'Sketch the chart\nAdd a “log class” button\nPick colours'
          }
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
        />
      </div>

      <p className="text-sm font-medium">For all of them</p>
      <EffortFields
        minutesLabel="Each takes about"
        minutes={minutes}
        onMinutesChange={setMinutes}
        energy={energy}
        onEnergyChange={setEnergy}
        importance={importance}
        onImportanceChange={setImportance}
      />

      {create.error && (
        <p className="text-sm text-danger" role="alert">
          {create.error.message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={count === 0 || create.isPending}>
          {create.isPending
            ? 'Adding…'
            : count === 0
              ? 'Add tasks'
              : count === 1
                ? 'Add 1 task'
                : `Add ${count} tasks`}
        </Button>
        <Button type="button" variant="ghost" onClick={() => onDone(0)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
