import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { describeCheckIn, tasksThatFit, type CheckIn } from '../../lib/checkIn'
import { describeTask } from '../../lib/tasks'
import { useProjects } from '../projects/useProjects'
import { useOpenTasks } from '../tasks/useTasks'
import { CheckInForm } from './CheckInForm'

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

/**
 * The recommendation screen. Until the engine lands (#11) it lists every task
 * that fits the check-in; the engine will narrow this to one explained pick.
 */
function Recommendation({
  checkIn,
  onChange,
}: {
  checkIn: CheckIn
  onChange: () => void
}) {
  const tasks = useOpenTasks()
  const projects = useProjects()

  const error = tasks.error ?? projects.error
  const fits =
    tasks.data && projects.data
      ? tasksThatFit(tasks.data, projects.data, checkIn)
      : null

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
      {!error && !fits && (
        <p className="text-sm text-muted-foreground">Finding what fits…</p>
      )}

      {fits && fits.length === 0 && (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Nothing on your list fits right now. That’s okay: rest counts too. Or
          add a smaller task in the{' '}
          <a className="text-accent underline underline-offset-2" href="#tasks">
            Tasks
          </a>{' '}
          tab.
        </p>
      )}

      {fits && fits.length > 0 && (
        <section aria-labelledby="fits-heading" className="grid gap-3">
          <h2 id="fits-heading" className="text-xl font-semibold">
            Things that fit
          </h2>
          <ul className="grid gap-2">
            {fits.map((task) => (
              <li
                key={task.id}
                className="rounded-lg border border-border bg-muted px-4 py-3 shadow-sm"
              >
                <p className="font-medium">{task.title}</p>
                <p className="text-xs text-muted-foreground">
                  {describeTask(task)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
