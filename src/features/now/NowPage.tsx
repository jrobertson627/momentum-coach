import { useMemo, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { explain } from '../../engine/explain'
import {
  easierAlternative,
  rankTasks,
  type EasierAlternative,
} from '../../engine/recommend'
import type { TaskAction } from '../../lib/actions'
import { describeCheckIn, type CheckIn } from '../../lib/checkIn'
import { nextOccurrence, parseRepeat } from '../../lib/repeat'
import { creditsFor, SMALLER_STEP_MINUTES } from '../../lib/rewards'
import { describeTask, type Task } from '../../lib/tasks'
import { useProjects } from '../projects/useProjects'
import { useOpenTasks } from '../tasks/useTasks'
import { CheckInForm } from './CheckInForm'
import { GameTime } from './GameTime'
import { Completed, type CompletedProps } from './Completed'
import { PickActions } from './PickActions'
import { useActOnTask } from './useActOnTask'
import { useRecentEvents } from './useRecentEvents'

const STORAGE_KEY = 'momentum:check-in'

const laterFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
})

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

  return (
    <div className="grid gap-6">
      <GameTime />
      {editing || !checkIn ? (
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
      ) : (
        <Recommendation checkIn={checkIn} onChange={() => setEditing(true)} />
      )}
    </div>
  )
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
  const input = useMemo(
    () =>
      tasks.data && projects.data && events.data
        ? {
            tasks: tasks.data,
            projects: projects.data,
            events: events.data,
            checkIn,
            now: new Date(),
          }
        : null,
    [tasks.data, projects.data, events.data, checkIn],
  )
  const ranked = useMemo(() => (input ? rankTasks(input) : null), [input])
  const [best, ...others] = ranked ?? []

  // "Too much right now": each press steps to something lighter.
  const [steps, setSteps] = useState<EasierAlternative<Task>[]>([])
  const [nothingLighter, setNothingLighter] = useState(false)
  const current = steps.at(-1)?.recommendation ?? best

  function easier() {
    if (!input || !current) return
    const shown = new Set([
      best.task.id,
      ...steps.map((s) => s.recommendation.task.id),
    ])
    const next = easierAlternative(
      { ...input, checkIn: steps.at(-1)?.checkIn ?? input.checkIn },
      current,
      shown,
    )
    if (next) setSteps([...steps, next])
    else setNothingLighter(true)
  }

  function backToFirst() {
    setSteps([])
    setNothingLighter(false)
  }

  const act = useActOnTask()
  const [completed, setCompleted] = useState<CompletedProps | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function onAct(requested: TaskAction) {
    if (!current) return
    const { task, useSmallerVersion } = current
    const repeat = parseRepeat(task.repeat)
    // Done on a smaller version finishes the first step, not the whole task;
    // a repeating task is scheduled to come back instead of being finished.
    const action: TaskAction =
      requested.kind === 'completed' && useSmallerVersion
        ? { kind: 'progressed' }
        : requested.kind === 'completed' && repeat
          ? {
              kind: 'completed',
              nextOccurrence: nextOccurrence(repeat, new Date()),
            }
          : requested
    setNotice(null)
    act.mutate(
      { taskId: task.id, action, checkIn },
      {
        onSuccess: () => {
          backToFirst()
          if (action.kind === 'completed') {
            const project = projects.data?.find((p) => p.id === task.project_id)
            setCompleted({
              title: task.title,
              step: null,
              earned: creditsFor(task.estimated_minutes),
              backOn: action.nextOccurrence ?? null,
              // A routine doesn't need a "next step"; it comes back by itself.
              project:
                project && !action.nextOccurrence
                  ? { id: project.id, name: project.name }
                  : null,
            })
          } else if (action.kind === 'progressed') {
            setCompleted({
              title: task.title,
              step: task.smaller_version,
              earned: creditsFor(SMALLER_STEP_MINUTES),
              backOn: null,
              project: null,
            })
          } else if (action.kind === 'skipped') {
            setNotice(`Skipped “${task.title}”. Here’s something else.`)
          } else {
            setNotice(
              `“${task.title}” will be back ${laterFormat.format(action.until)}.`,
            )
          }
        },
      },
    )
  }

  if (completed) {
    return <Completed {...completed} onContinue={() => setCompleted(null)} />
  }

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

      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}

      {current && (
        <section
          aria-labelledby="pick-heading"
          className="grid gap-3 rounded-lg border border-accent/40 bg-muted p-6 shadow-md"
        >
          <p
            id="pick-heading"
            className="text-xs font-medium tracking-wide text-accent uppercase"
          >
            {current.useSmallerVersion
              ? 'Start small'
              : steps.length > 0
                ? 'Something lighter'
                : 'Your next step'}
          </p>
          {current.useSmallerVersion ? (
            <>
              <h2 className="text-2xl font-semibold">
                {current.task.smaller_version}
              </h2>
              <p className="text-sm text-muted-foreground">
                A first step toward “{current.task.title}”
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-semibold">{current.task.title}</h2>
              <p className="text-sm text-muted-foreground">
                {describeTask(current.task)}
              </p>
            </>
          )}
          {current.task.project_id && (
            <p className="text-sm">
              For <strong>{projectName(current.task.project_id)}</strong>
            </p>
          )}
          <p className="border-t border-border pt-3 text-sm text-muted-foreground">
            {explain(current)}
          </p>

          <PickActions pending={act.isPending} onAct={onAct} />
          {act.error && (
            <p className="text-sm text-danger" role="alert">
              {act.error.message}
            </p>
          )}

          {nothingLighter && (
            <p role="status" className="text-sm">
              This is the lightest thing on your list right now. It’s okay to
              take a break instead.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {!nothingLighter && (
              <Button size="sm" variant="secondary" onClick={easier}>
                Too much right now
              </Button>
            )}
            {steps.length > 0 && (
              <Button size="sm" variant="ghost" onClick={backToFirst}>
                Back to the first suggestion
              </Button>
            )}
          </div>
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
