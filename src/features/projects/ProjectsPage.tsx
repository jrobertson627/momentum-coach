import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import {
  ACTIVE_PROJECT_LIMIT,
  ActiveLimitError,
  groupProjects,
  type Project,
} from '../../lib/projects'
import { ProjectCard } from './ProjectCard'
import { ProjectForm, type ProjectFormValues } from './ProjectForm'
import { useCreateProject, useParkIdea, useProjects } from './useProjects'

export function ProjectsPage() {
  const { data: projects, isPending, error } = useProjects()
  const [adding, setAdding] = useState(false)
  const [parkedName, setParkedName] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading projects…</p>
  }
  if (error) {
    return (
      <p className="text-sm text-danger" role="alert">
        Couldn’t load your projects: {error.message}
      </p>
    )
  }

  const groups = groupProjects(projects)
  const activeCount = groups.active.length
  const atLimit = activeCount >= ACTIVE_PROJECT_LIMIT

  return (
    <div className="grid gap-8">
      <header className="grid gap-1">
        <h2 className="text-2xl font-semibold">Projects</h2>
        <p className="text-sm text-muted-foreground">
          Up to {ACTIVE_PROJECT_LIMIT} active at a time. Finishing beats
          starting.
        </p>
      </header>

      <section aria-labelledby="active-heading" className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 id="active-heading" className="text-lg font-semibold">
            Active{' '}
            <span className="font-sans text-sm font-normal text-muted-foreground">
              {activeCount} of {ACTIVE_PROJECT_LIMIT}
            </span>
          </h3>
          {!adding && (
            <Button
              size="sm"
              variant={atLimit ? 'secondary' : 'primary'}
              onClick={() => {
                setParkedName(null)
                setAdding(true)
              }}
            >
              New project
            </Button>
          )}
        </div>

        {parkedName && (
          <p
            role="status"
            className="rounded-md border border-border bg-muted px-3 py-2 text-sm"
          >
            “{parkedName}” is saved in your ideas. You can start it once a slot
            frees up.
          </p>
        )}

        {adding && (
          <NewProjectPanel
            atLimit={atLimit}
            onDone={(parked) => {
              setAdding(false)
              setParkedName(parked)
            }}
          />
        )}

        {groups.active.length === 0 && !adding && (
          <EmptyState text="No active projects. Start one you’d like to finish." />
        )}
        <ProjectList projects={groups.active} atLimit={atLimit} />
      </section>

      {groups.paused.length > 0 && (
        <Section title="Paused">
          <ProjectList projects={groups.paused} atLimit={atLimit} />
        </Section>
      )}

      {groups.finished.length > 0 && (
        <Section title="Finished">
          <ProjectList projects={groups.finished} atLimit={atLimit} />
        </Section>
      )}

      {groups.archived.length > 0 && (
        <div className="grid gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="justify-self-start"
            aria-expanded={showArchived}
            onClick={() => setShowArchived((s) => !s)}
          >
            {showArchived ? 'Hide' : 'Show'} archived ({groups.archived.length})
          </Button>
          {showArchived && (
            <ProjectList projects={groups.archived} atLimit={atLimit} />
          )}
        </div>
      )}
    </div>
  )
}

function NewProjectPanel({
  atLimit,
  onDone,
}: {
  atLimit: boolean
  /** Called with the project name when it was parked instead of started. */
  onDone: (parkedName: string | null) => void
}) {
  const create = useCreateProject()
  const park = useParkIdea()
  // The server may know about a project started on another device.
  const [limitHit, setLimitHit] = useState(false)
  const full = atLimit || limitHit
  function submit(values: ProjectFormValues, action?: string) {
    // Enter in a field submits via the first button, so "full" defaults to park.
    const intent = action ?? (full ? 'park' : 'start')
    if (intent === 'park') {
      const notes = values.definition_of_done
        ? `Done when: ${values.definition_of_done}`
        : undefined
      park.mutate(
        { text: values.name, notes },
        { onSuccess: () => onDone(values.name) },
      )
      return
    }
    create.mutate(
      {
        name: values.name,
        why: values.why || null,
        definition_of_done: values.definition_of_done || null,
        status: intent === 'pause' ? 'paused' : 'active',
      },
      {
        onSuccess: () => onDone(null),
        onError: (err) => {
          if (err instanceof ActiveLimitError) setLimitHit(true)
        },
      },
    )
  }

  const pending = create.isPending || park.isPending
  const failure = park.error ?? create.error
  const error =
    failure && !(failure instanceof ActiveLimitError) ? failure.message : null

  return (
    <Card>
      <h3 className="sr-only">New project</h3>
      <ProjectForm
        onSubmit={submit}
        error={error}
        notice={
          full && (
            <div
              role="alert"
              className="rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-foreground"
            >
              <p className="font-medium">You already have 3 active projects.</p>
              <p>
                Starting a fourth makes it harder to finish any of them. Park
                this idea for later, or save it as paused. Your active projects
                stay as they are.
              </p>
            </div>
          )
        }
        actions={() =>
          full ? (
            <>
              <Button type="submit" value="park" disabled={pending}>
                Park it as an idea
              </Button>
              <Button
                type="submit"
                variant="secondary"
                value="pause"
                disabled={pending}
              >
                Save as paused
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onDone(null)}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button type="submit" value="start" disabled={pending}>
                {pending ? 'Saving…' : 'Start project'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onDone(null)}
              >
                Cancel
              </Button>
            </>
          )
        }
      />
    </Card>
  )
}

function ProjectList({
  projects,
  atLimit,
}: {
  projects: Project[]
  atLimit: boolean
}) {
  return (
    <ul className="grid gap-3">
      {projects.map((project) => (
        <li key={project.id}>
          <ProjectCard project={project} atActiveLimit={atLimit} />
        </li>
      ))}
    </ul>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="grid gap-3">
      <h3 className="text-lg font-semibold">{title}</h3>
      {children}
    </section>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
      {text}
    </p>
  )
}
