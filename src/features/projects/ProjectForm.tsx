import { useId, useState, type FormEvent, type ReactNode } from 'react'

export type ProjectFormValues = {
  name: string
  why: string
  definition_of_done: string
}

const empty: ProjectFormValues = { name: '', why: '', definition_of_done: '' }

const fieldClass =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground'

type Props = {
  initial?: Partial<ProjectFormValues>
  /** Renders the submit area; receives the current values. */
  actions: (values: ProjectFormValues) => ReactNode
  /** `action` is the `value` of the submit button that was pressed, if any. */
  onSubmit: (values: ProjectFormValues, action?: string) => void
  notice?: ReactNode
  error?: string | null
}

export function ProjectForm({
  initial,
  actions,
  onSubmit,
  notice,
  error,
}: Props) {
  const id = useId()
  const [values, setValues] = useState<ProjectFormValues>({
    ...empty,
    ...initial,
  })

  function set<K extends keyof ProjectFormValues>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const submitter = (e.nativeEvent as SubmitEvent).submitter
    onSubmit(
      {
        name: values.name.trim(),
        why: values.why.trim(),
        definition_of_done: values.definition_of_done.trim(),
      },
      submitter?.getAttribute('value') ?? undefined,
    )
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-name`} className="text-sm font-medium">
          Name
        </label>
        <input
          id={`${id}-name`}
          autoFocus
          required
          maxLength={120}
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. Workout tracker"
          className={fieldClass}
        />
      </div>

      <div className="grid gap-1.5">
        <label htmlFor={`${id}-done`} className="text-sm font-medium">
          Done when…
        </label>
        <p id={`${id}-done-hint`} className="text-xs text-muted-foreground">
          What does “good enough” look like? Finishing this beats polishing it.
        </p>
        <textarea
          id={`${id}-done`}
          aria-describedby={`${id}-done-hint`}
          rows={2}
          maxLength={1000}
          value={values.definition_of_done}
          onChange={(e) => set('definition_of_done', e.target.value)}
          placeholder="e.g. I can log a workout on my phone and see a weekly chart"
          className={fieldClass}
        />
      </div>

      <div className="grid gap-1.5">
        <label htmlFor={`${id}-why`} className="text-sm font-medium">
          Why it matters <span className="font-normal">(optional)</span>
        </label>
        <textarea
          id={`${id}-why`}
          rows={2}
          maxLength={1000}
          value={values.why}
          onChange={(e) => set('why', e.target.value)}
          className={fieldClass}
        />
      </div>

      {notice}

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">{actions(values)}</div>
    </form>
  )
}
