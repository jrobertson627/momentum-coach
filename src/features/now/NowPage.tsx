import { useMemo, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { rankTasks } from '../../engine/recommend'
import { describeCheckIn, type CheckIn } from '../../lib/checkIn'
import { describeTask } from '../../lib/tasks'
import { useProjects } from '../projects/useProjects'
import { useOpenTasks } from '../tasks/useTasks'
import { CheckInForm } from './CheckInForm'
import { useRecentEvents } from './useRecentEvents'

const STORAGE_KEY = 'momentum:check-in'

// Remember the check-in for this browser session so switching tabs doesn't
// ask again. Storage can be unavailable (private mode), so failures are fine.
function loadCheckIn(): CheckIn | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CheckIn) : null
  } catch {
    return null
  }
}

function saveCheckIn(checkIn: CheckIn | null) {
  try {
    if (checkIn) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(checkIn))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Not critical.
  }
}

export function NowPage() {
  const [checkIn, setCheckIn] = useState<CheckIn | null>(loadCheckIn)
  const [editing, setEditing] = useState(checkIn === null)

  function update(next: CheckIn) {
    saveCheckIn(next)
    setCheckIn(next)
    setEditing(false)
  }

  if (editing || !checkIn) {
    return (
      <div className="grid gap-6">
        <header className="grid gap-1">
          <h2 className="text-2xl font-semibold">What now?</h2>
          <p className="text-sm text-muted-foreground">
            Two quick taps and I’ll find something that fits.
          </p>
        </header>
        <CheckInForm initial={checkIn} onSubmit={update} />
        {checkIn && (
          <Button
            variant="ghost"
            className="justify-self-start"
            onClick={() => setEditing(false)}
          >
            Keep as is
          </Button>
        )}
      </div>
    )
  }

  return <Recommendation checkIn={checkIn} onChange={() => setEditing(true)} />
}

/** The recommendation screen: one pick for right now, with other options. */
function Recommendation({
  checkIn,
  onChange,
}: {
  checkIn: CheckIn
  onChange: () => void
}) {
  const tasks = useOpenTasks()
  const projects = useProjects()
  const events = useRecentEvents()

  const error = tasks.error ?? projects.error ?? events.error
  const ranked = useMemo(
    () =>
      tasks.data && projects.data && events.data
        ? rankTasks({
            tasks: tasks.data,
            projects: projects.data,
            events: events.data,
            checkIn,
            now: new Date(),
          })
        : null,
    [tasks.data, projects.data, events.data, checkIn],
  )

  const [best, ...others] = ranked ?? []
  const projectName = (id: string | null) =>
    projects.data?.find((p) => p.id === id)?.name

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted px-4 py-3">
        <p className="text-sm">
          You have <strong>{describeCheckIn(checkIn)}</strong>.
        </p>
        <Button size="sm" variant="ghost" onClick={onChange}>
          Change
        </Button>
      </div>

      {error && (
        <p className="text-sm text-danger" role="alert">
          Couldn’t load your tasks: {error.message}
        </p>
      )}
      {!error && !ranked && (
        <p className="text-sm text-muted-foreground">Finding what fits…</p>
      )}

      {ranked && !best && (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Nothing on your list fits right now. That’s okay: rest counts too. Or
          add a smaller task in the{' '}
          <a className="text-accent underline underline-offset-2" href="#tasks">
            Tasks
          </a>{' '}
          tab.
        </p>
      )}

      {best && (
        <section
          aria-labelledby="pick-heading"
          className="grid gap-3 rounded-lg border border-accent/40 bg-muted p-6 shadow-md"
        >
          <p
            id="pick-heading"
            className="text-xs font-medium tracking-wide text-accent uppercase"
          >
            {best.useSmallerVersion ? 'Start small' : 'Your next step'}
          </p>
          {best.useSmallerVersion ? (
            <>
              <h2 className="text-2xl font-semibold">
                {best.task.smaller_version}
              </h2>
              <p className="text-sm text-muted-foreground">
                A first step toward “{best.task.title}”
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-semibold">{best.task.title}</h2>
              <p className="text-sm text-muted-foreground">
                {describeTask(best.task)}
              </p>
            </>
          )}
          {best.task.project_id && (
            <p className="text-sm">
              For <strong>{projectName(best.task.project_id)}</strong>
            </p>
          )}
        </section>
      )}

      {others.length > 0 && (
        <details className="group rounded-lg border border-border bg-muted px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium">
            Other options ({others.length})
          </summary>
          <ul className="mt-3 grid gap-2">
            {others.map(({ task, useSmallerVersion }) => (
              <li key={task.id} className="border-t border-border pt-2">
                <p className="text-sm font-medium">
                  {useSmallerVersion ? task.smaller_version : task.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {useSmallerVersion
                    ? `First step toward “${task.title}”`
                    : describeTask(task)}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
