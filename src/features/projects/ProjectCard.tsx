import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import {
  ActiveLimitError,
  statusChange,
  type Project,
  type ProjectStatus,
} from '../../lib/projects'
import { ProjectForm } from './ProjectForm'
import { useUpdateProject } from './useProjects'

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

type Props = {
  project: Project
  atActiveLimit: boolean
}

export function ProjectCard({ project, atActiveLimit }: Props) {
  const update = useUpdateProject()
  const [editing, setEditing] = useState(false)
  const [limitHit, setLimitHit] = useState(false)

  function move(status: ProjectStatus) {
    if (status === 'active' && atActiveLimit) {
      setLimitHit(true)
      return
    }
    setLimitHit(false)
    update.mutate(
      { id: project.id, changes: statusChange(status) },
      {
        onError: (err) => {
          if (err instanceof ActiveLimitError) setLimitHit(true)
        },
      },
    )
  }

  const error =
    update.error && !(update.error instanceof ActiveLimitError)
      ? update.error.message
      : null

  if (editing) {
    return (
      <Card>
        <h3 className="sr-only">Edit {project.name}</h3>
        <ProjectForm
          initial={{
            name: project.name,
            why: project.why ?? '',
            definition_of_done: project.definition_of_done ?? '',
          }}
          error={error}
          onSubmit={(values) =>
            update.mutate(
              {
                id: project.id,
                changes: {
                  name: values.name,
                  why: values.why || null,
                  definition_of_done: values.definition_of_done || null,
                },
              },
              { onSuccess: () => setEditing(false) },
            )
          }
          actions={() => (
            <>
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? 'Saving…' : 'Save'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  update.reset()
                  setEditing(false)
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

  const { status } = project

  return (
    <Card className="grid gap-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold">{project.name}</h3>
        {status === 'finished' && project.finished_at && (
          <span className="shrink-0 rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
            Finished {dateFormat.format(new Date(project.finished_at))}
          </span>
        )}
      </div>

      {project.definition_of_done ? (
        <div className="rounded-md border-l-4 border-accent bg-background px-3 py-2">
          <p className="text-xs font-medium tracking-wide text-accent uppercase">
            Done when
          </p>
          <p className="text-sm">{project.definition_of_done}</p>
        </div>
      ) : (
        status !== 'archived' && (
          <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
            No finish line yet.{' '}
            <button
              type="button"
              className="text-accent underline underline-offset-2"
              onClick={() => setEditing(true)}
            >
              Add a definition of done
            </button>{' '}
            so you know when it’s good enough.
          </p>
        )
      )}

      {project.why && (
        <p className="text-sm text-muted-foreground">{project.why}</p>
      )}

      {limitHit && (
        <div
          role="alert"
          className="rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-foreground"
        >
          You already have 3 active projects. Pause or finish one of them first.
          This one will wait here, paused, until there’s room.
        </div>
      )}
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {status === 'active' && (
          <>
            <Button size="sm" onClick={() => move('finished')}>
              Mark finished
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => move('paused')}
            >
              Pause
            </Button>
          </>
        )}
        {status === 'paused' && (
          <Button size="sm" onClick={() => move('active')}>
            Resume
          </Button>
        )}
        {status === 'finished' && (
          <Button size="sm" variant="secondary" onClick={() => move('active')}>
            Reopen
          </Button>
        )}
        {status === 'archived' ? (
          <Button size="sm" variant="secondary" onClick={() => move('paused')}>
            Restore
          </Button>
        ) : (
          <>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => move('archived')}>
              Archive
            </Button>
          </>
        )}
      </div>
    </Card>
  )
}
