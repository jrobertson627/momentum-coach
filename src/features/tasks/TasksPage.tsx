import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import type { Project } from '../../lib/projects'
import { describeTask, groupTasks, type Task } from '../../lib/tasks'
import { useProjects } from '../projects/useProjects'
import { BulkAddForm } from './BulkAddForm'
import { TaskForm } from './TaskForm'
import {
  useCreateTask,
  useDeleteTask,
  useOpenTasks,
  useUpdateTask,
} from './useTasks'

export function TasksPage() {
  const tasks = useOpenTasks()
  const projects = useProjects()
  // Which section is adding tasks (project id, or null for chores), and how.
  const [adding, setAdding] = useState<{
    key: string | null
    mode: 'one' | 'several'
  } | null>(null)
  const [added, setAdded] = useState<{
    key: string | null
    count: number
  } | null>(null)

  const error = tasks.error ?? projects.error
  if (error) {
    return (
      <p className="text-sm text-danger" role="alert">
        Couldn’t load your tasks: {error.message}
      </p>
    )
  }
  if (!tasks.data || !projects.data) {
    return <p className="text-sm text-muted-foreground">Loading tasks…</p>
  }

  const assignable = projects.data.filter(
    (p) => p.status === 'active' || p.status === 'paused',
  )
  const groups = groupTasks(tasks.data, projects.data)

  return (
    <div className="grid gap-8">
      <header className="grid gap-1">
        <h2 className="text-2xl font-semibold">Tasks</h2>
        <p className="text-sm text-muted-foreground">
          Small, concrete next steps for your projects, plus the chores and
          obligations that need doing anyway.
        </p>
      </header>

      {groups.map(({ project, tasks: groupTasks }) => {
        const key = project?.id ?? null
        const heading = project ? project.name : 'Chores & obligations'
        return (
          <section
            key={key ?? 'standalone'}
            aria-label={heading}
            className="grid gap-3"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">
                {heading}
                {project?.status === 'paused' && (
                  <span className="ml-2 font-sans text-sm font-normal text-muted-foreground">
                    paused
                  </span>
                )}
              </h3>
              {adding?.key !== key && (
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setAdded(null)
                      setAdding({ key, mode: 'several' })
                    }}
                  >
                    Add several
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setAdded(null)
                      setAdding({ key, mode: 'one' })
                    }}
                  >
                    Add task
                  </Button>
                </div>
              )}
            </div>

            {adding?.key === key && adding.mode === 'one' && (
              <NewTask
                projectId={key}
                projects={assignable}
                onDone={() => setAdding(null)}
              />
            )}
            {adding?.key === key && adding.mode === 'several' && (
              <Card>
                <BulkAddForm
                  projectId={key}
                  projectName={project?.name}
                  onDone={(count) => {
                    setAdding(null)
                    if (count > 0) setAdded({ key, count })
                  }}
                />
              </Card>
            )}
            {added?.key === key && (
              <p role="status" className="text-sm text-muted-foreground">
                Added {added.count} {added.count === 1 ? 'task' : 'tasks'}. Use
                Edit to fine-tune any of them.
              </p>
            )}

            {groupTasks.length === 0 && adding?.key !== key && (
              <p className="rounded-lg border border-dashed border-border px-4 py-4 text-center text-sm text-muted-foreground">
                {project
                  ? 'No next step yet. What’s the smallest thing that moves this forward?'
                  : 'No chores or obligations. Nice.'}
              </p>
            )}

            <ul className="grid gap-2">
              {groupTasks.map((task) => (
                <li key={task.id}>
                  <TaskItem task={task} projects={assignable} />
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function NewTask({
  projectId,
  projects,
  onDone,
}: {
  projectId: string | null
  projects: Project[]
  onDone: () => void
}) {
  const create = useCreateTask()

  return (
    <Card>
      <h4 className="sr-only">New task</h4>
      <TaskForm
        initial={{ project_id: projectId }}
        projects={projects}
        error={create.error?.message}
        onSubmit={(task) => create.mutate(task, { onSuccess: onDone })}
        actions={
          <>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Adding…' : 'Add task'}
            </Button>
            <Button type="button" variant="ghost" onClick={onDone}>
              Cancel
            </Button>
          </>
        }
      />
    </Card>
  )
}

function TaskItem({ task, projects }: { task: Task; projects: Project[] }) {
  const update = useUpdateTask()
  const remove = useDeleteTask()
  const [mode, setMode] = useState<'view' | 'edit' | 'confirm-delete'>('view')

  if (mode === 'edit') {
    return (
      <Card>
        <h4 className="sr-only">Edit {task.title}</h4>
        <TaskForm
          initial={task}
          projects={projects}
          error={update.error?.message}
          onSubmit={(changes) =>
            update.mutate(
              { id: task.id, changes },
              { onSuccess: () => setMode('view') },
            )
          }
          actions={
            <>
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? 'Saving…' : 'Save'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  update.reset()
                  setMode('view')
                }}
              >
                Cancel
              </Button>
            </>
          }
        />
      </Card>
    )
  }

  return (
    <div className="grid gap-2 rounded-lg border border-border bg-muted px-4 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-0.5">
          <p className="font-medium">{task.title}</p>
          <p className="text-xs text-muted-foreground">{describeTask(task)}</p>
          {task.smaller_version && (
            <p className="text-xs text-muted-foreground">
              Smaller: {task.smaller_version}
            </p>
          )}
        </div>
        {mode === 'view' && (
          <div className="flex shrink-0 gap-1">
            <Button size="sm" variant="ghost" onClick={() => setMode('edit')}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setMode('confirm-delete')}
            >
              Delete
            </Button>
          </div>
        )}
      </div>

      {mode === 'confirm-delete' && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">Delete this task?</span>
          <Button
            size="sm"
            variant="secondary"
            disabled={remove.isPending}
            onClick={() => remove.mutate(task.id)}
          >
            Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMode('view')}>
            Keep it
          </Button>
        </div>
      )}
      {remove.error && (
        <p className="text-sm text-danger" role="alert">
          {remove.error.message}
        </p>
      )}
    </div>
  )
}
