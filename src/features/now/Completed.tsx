import { useId, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { formatCredits } from '../../lib/rewards'
import { useCreateTask } from '../tasks/useTasks'

const backFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
})

export type CompletedProps = {
  title: string
  /** Set when only the task's smaller version (a first step) was done. */
  step: string | null
  /** Game-time minutes earned. */
  earned: number
  /** For repeating tasks: when it comes back. */
  backOn: Date | null
  /** For finished project tasks: ask for the project's next step. */
  project: { id: string; name: string } | null
}

/**
 * Shown after finishing a task or a first step. For finished project tasks it
 * asks for the next step straight away, so the project never stalls.
 */
export function Completed({
  title,
  step,
  earned,
  backOn,
  project,
  onContinue,
}: CompletedProps & { onContinue: () => void }) {
  const id = useId()
  const create = useCreateTask()
  const [next, setNext] = useState('')

  function addNext(e: FormEvent) {
    e.preventDefault()
    if (!project || !next.trim()) return
    create.mutate(
      { title: next.trim(), project_id: project.id },
      { onSuccess: onContinue },
    )
  }

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="grid gap-4 rounded-lg border border-accent/40 bg-muted p-6 shadow-md"
    >
      <div className="grid gap-1">
        <p
          id={`${id}-heading`}
          className="text-xs font-medium tracking-wide text-accent uppercase"
        >
          {step ? 'First step done' : 'Done'}
        </p>
        <h2 className="text-2xl font-semibold">Nice work.</h2>
        <p className="text-sm text-muted-foreground">
          {step
            ? `“${step}” is done. “${title}” stays on your list, a little lighter.`
            : backOn
              ? `“${title}” is done for now. See you again ${backFormat.format(backOn)}.`
              : `“${title}” is finished.`}
        </p>
        <p className="mt-2 text-sm font-medium text-accent">
          +{formatCredits(earned)} of game time
        </p>
      </div>

      {project ? (
        <form className="grid gap-2" onSubmit={addNext}>
          <label htmlFor={`${id}-next`} className="text-sm font-medium">
            What’s the next step for {project.name}?
          </label>
          <input
            id={`${id}-next`}
            autoFocus
            maxLength={200}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="The smallest thing that moves it forward"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
          />
          <p className="text-xs text-muted-foreground">
            You can add time and energy details in the Tasks tab.
          </p>
          {create.error && (
            <p className="text-sm text-danger" role="alert">
              {create.error.message}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={create.isPending || !next.trim()}
            >
              Add next step
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onContinue}
            >
              Not now
            </Button>
          </div>
        </form>
      ) : (
        <Button className="justify-self-start" onClick={onContinue}>
          What’s next?
        </Button>
      )}
    </section>
  )
}
