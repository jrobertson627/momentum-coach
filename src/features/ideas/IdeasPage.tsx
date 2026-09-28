import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { splitNotes, type Idea } from '../../lib/ideas'
import {
  ACTIVE_PROJECT_LIMIT,
  ActiveLimitError,
  groupProjects,
} from '../../lib/projects'
import { ProjectForm } from '../projects/ProjectForm'
import { useProjects } from '../projects/useProjects'
import { useDeleteIdea, useIdeas, usePromoteIdea } from './useIdeas'

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

export function IdeasPage() {
  const ideas = useIdeas()
  const projects = useProjects()
  const [started, setStarted] = useState<string | null>(null)

  const error = ideas.error ?? projects.error
  if (error) {
    return (
      <p className="text-sm text-danger" role="alert">
        Couldn’t load your ideas: {error.message}
      </p>
    )
  }

  if (!ideas.data || !projects.data) {
    return <p className="text-sm text-muted-foreground">Loading ideas…</p>
  }

  const activeCount = groupProjects(projects.data).active.length
  const atLimit = activeCount >= ACTIVE_PROJECT_LIMIT

  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <h2 className="text-2xl font-semibold">Parking lot</h2>
        <p className="text-sm text-muted-foreground">
          New ideas wait here so they don’t pull you away from what you’re
          finishing.
        </p>
      </header>

      {started && (
        <p
          role="status"
          className="rounded-md border border-border bg-muted px-3 py-2 text-sm"
        >
          “{started}” is now an active project.
        </p>
      )}

      {atLimit && ideas.data.length > 0 && (
        <p className="rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm">
          All {ACTIVE_PROJECT_LIMIT} project slots are full. Finish or pause a
          project to start one of these.
        </p>
      )}

      {ideas.data.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Nothing parked. When a new idea tugs at you, park it here and get back
          to what you’re finishing.
        </p>
      ) : (
        <ul className="grid gap-3">
          {ideas.data.map((idea) => (
            <li key={idea.id}>
              <IdeaCard
                idea={idea}
                atLimit={atLimit}
                onStarted={(name) => setStarted(name)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function IdeaCard({
  idea,
  atLimit,
  onStarted,
}: {
  idea: Idea
  atLimit: boolean
  onStarted: (name: string) => void
}) {
  const promote = usePromoteIdea()
  const remove = useDeleteIdea()
  const [mode, setMode] = useState<'view' | 'promote' | 'confirm-delete'>(
    'view',
  )
  const { definitionOfDone, rest } = splitNotes(idea.notes)

  const limitHit = promote.error instanceof ActiveLimitError
  const error =
    (promote.error && !limitHit ? promote.error.message : null) ??
    remove.error?.message ??
    null

  if (mode === 'promote') {
    return (
      <Card>
        <h3 className="sr-only">Start “{idea.text}” as a project</h3>
        <ProjectForm
          initial={{
            name: idea.text,
            definition_of_done: definitionOfDone,
            why: rest,
          }}
          error={error}
          notice={
            limitHit && (
              <p
                role="alert"
                className="rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm"
              >
                You already have 3 active projects. This idea will stay parked
                until one is finished or paused.
              </p>
            )
          }
          onSubmit={(values) =>
            promote.mutate(
              {
                id: idea.id,
                project: {
                  name: values.name,
                  why: values.why || null,
                  definition_of_done: values.definition_of_done || null,
                  status: 'active',
                },
              },
              { onSuccess: () => onStarted(values.name) },
            )
          }
          actions={() => (
            <>
              <Button type="submit" disabled={promote.isPending || limitHit}>
                {promote.isPending ? 'Starting…' : 'Start project'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  promote.reset()
                  setMode('view')
                }}
              >
                Cancel
              </Button>
            </>
          )}
        />
      </Card>
    )
  }

  return (
    <Card className="grid gap-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold">{idea.text}</h3>
        <span className="shrink-0 text-xs text-muted-foreground">
          Parked {dateFormat.format(new Date(idea.created_at))}
        </span>
      </div>

      {definitionOfDone && (
        <p className="text-sm">
          <span className="text-muted-foreground">Done when: </span>
          {definitionOfDone}
        </p>
      )}
      {rest && <p className="text-sm text-muted-foreground">{rest}</p>}

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {mode === 'confirm-delete' ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">Let go of this idea?</span>
          <Button
            size="sm"
            variant="secondary"
            disabled={remove.isPending}
            onClick={() => remove.mutate(idea.id)}
          >
            Let go
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMode('view')}>
            Keep it
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={atLimit}
            title={atLimit ? 'All 3 project slots are full' : undefined}
            onClick={() => setMode('promote')}
          >
            Start as project
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setMode('confirm-delete')}
          >
            Let go
          </Button>
        </div>
      )}
    </Card>
  )
}
