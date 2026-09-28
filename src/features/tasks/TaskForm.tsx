import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Segmented } from '../../components/ui/Segmented'
import type { Project } from '../../lib/projects'
import {
  ENERGY_LABELS,
  IMPORTANCE_LABELS,
  type Energy,
  type TaskFields,
} from '../../lib/tasks'

const inputClass =
  'rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground'
const fieldClass = `w-full ${inputClass}`

const MINUTE_PRESETS = [10, 25, 45, 60]

type Props = {
  initial?: Partial<TaskFields>
  /** Projects a task can belong to (active and paused). */
  projects: Project[]
  onSubmit: (task: TaskFields) => void
  actions: ReactNode
  error?: string | null
}

export function TaskForm({
  initial,
  projects,
  onSubmit,
  actions,
  error,
}: Props) {
  const id = useId()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [projectId, setProjectId] = useState(initial?.project_id ?? '')
  const [minutes, setMinutes] = useState(
    String(initial?.estimated_minutes ?? 25),
  )
  const [energy, setEnergy] = useState<Energy>(initial?.energy ?? 'medium')
  const [importance, setImportance] = useState(initial?.importance ?? 2)
  const [dueDate, setDueDate] = useState(initial?.due_date ?? '')
  const [smaller, setSmaller] = useState(initial?.smaller_version ?? '')

  function submit(e: FormEvent) {
    e.preventDefault()
    onSubmit({
      title: title.trim(),
      project_id: projectId || null,
      estimated_minutes: Number(minutes),
      energy,
      importance,
      due_date: dueDate || null,
      smaller_version: smaller.trim() || null,
    })
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-title`} className="text-sm font-medium">
          Task
        </label>
        <input
          id={`${id}-title`}
          autoFocus
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Make the basic chart work"
          className={fieldClass}
        />
      </div>

      <div className="grid gap-1.5">
        <label htmlFor={`${id}-project`} className="text-sm font-medium">
          Project
        </label>
        <select
          id={`${id}-project`}
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className={fieldClass}
        >
          <option value="">None (chore or obligation)</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
              {project.status === 'paused' ? ' (paused)' : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-1.5">
        <label htmlFor={`${id}-minutes`} className="text-sm font-medium">
          About how long? <span className="font-normal">(minutes)</span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {MINUTE_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-pressed={Number(minutes) === preset}
              onClick={() => setMinutes(String(preset))}
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
            onChange={(e) => setMinutes(e.target.value)}
            className={`${inputClass} w-24`}
          />
        </div>
      </div>

      <Segmented
        legend="Energy needed"
        value={energy}
        onChange={setEnergy}
        options={(['low', 'medium', 'high'] as const).map((value) => ({
          value,
          label: ENERGY_LABELS[value].replace(' energy', ''),
        }))}
      />

      <Segmented
        legend="Importance"
        value={importance}
        onChange={setImportance}
        options={[1, 2, 3].map((value) => ({
          value,
          label: IMPORTANCE_LABELS[value],
        }))}
      />

      <div className="grid gap-1.5">
        <label htmlFor={`${id}-due`} className="text-sm font-medium">
          Due date <span className="font-normal">(optional)</span>
        </label>
        <input
          id={`${id}-due`}
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className={`${inputClass} justify-self-start`}
        />
      </div>

      <div className="grid gap-1.5">
        <label htmlFor={`${id}-smaller`} className="text-sm font-medium">
          Smaller version <span className="font-normal">(optional)</span>
        </label>
        <p id={`${id}-smaller-hint`} className="text-xs text-muted-foreground">
          An easier first step for when the whole thing feels like too much.
        </p>
        <input
          id={`${id}-smaller`}
          aria-describedby={`${id}-smaller-hint`}
          maxLength={200}
          value={smaller}
          onChange={(e) => setSmaller(e.target.value)}
          placeholder="e.g. Open the file and sketch the chart on paper"
          className={fieldClass}
        />
      </div>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">{actions}</div>
    </form>
  )
}
