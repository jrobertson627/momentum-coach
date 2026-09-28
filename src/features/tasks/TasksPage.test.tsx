// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as projectsApi from '../../lib/projects'
import type { Project } from '../../lib/projects'
import * as tasksApi from '../../lib/tasks'
import type { Task } from '../../lib/tasks'
import { TasksPage } from './TasksPage'

vi.mock('../../lib/tasks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/tasks')>()
  return {
    ...actual,
    fetchOpenTasks: vi.fn(),
    createTask: vi.fn(),
    createTasks: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
  }
})
vi.mock('../../lib/projects', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/projects')>()
  return { ...actual, fetchProjects: vi.fn() }
})

const fetchOpenTasks = vi.mocked(tasksApi.fetchOpenTasks)
const createTask = vi.mocked(tasksApi.createTask)
const createTasks = vi.mocked(tasksApi.createTasks)
const updateTask = vi.mocked(tasksApi.updateTask)
const deleteTask = vi.mocked(tasksApi.deleteTask)
const fetchProjects = vi.mocked(projectsApi.fetchProjects)

const tracker: Project = {
  id: 'tracker',
  user_id: 'user',
  name: 'Workout tracker',
  why: null,
  definition_of_done: null,
  status: 'active',
  finished_at: null,
  created_at: '',
  updated_at: '',
}

function task(overrides: Partial<Task>): Task {
  return {
    id: crypto.randomUUID(),
    user_id: 'user',
    project_id: null,
    title: 'Task',
    estimated_minutes: 25,
    energy: 'medium',
    importance: 2,
    due_date: null,
    smaller_version: null,
    status: 'open',
    deferred_until: null,
    completed_at: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

const chart = task({
  title: 'Make the basic chart work',
  project_id: 'tracker',
  estimated_minutes: 45,
  energy: 'high',
  importance: 3,
  smaller_version: 'Sketch the chart on paper',
})
const laundry = task({ title: 'Laundry', energy: 'low', importance: 1 })

function renderPage(tasks: Task[], projects: Project[] = [tracker]) {
  fetchOpenTasks.mockResolvedValue(tasks)
  fetchProjects.mockResolvedValue(projects)
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <TasksPage />
    </QueryClientProvider>,
  )
  return userEvent.setup()
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('TasksPage', () => {
  it('lists tasks under their project and chores separately', async () => {
    renderPage([chart, laundry])

    const project = await screen.findByRole('region', {
      name: 'Workout tracker',
    })
    expect(within(project).getByText('Make the basic chart work')).toBeVisible()
    expect(
      within(project).getByText('45 min · High energy · Essential'),
    ).toBeVisible()
    expect(
      within(project).getByText('Smaller: Sketch the chart on paper'),
    ).toBeVisible()

    const chores = screen.getByRole('region', { name: 'Chores & obligations' })
    expect(within(chores).getByText('Laundry')).toBeVisible()
  })

  it('prompts for a next step when an active project has no tasks', async () => {
    renderPage([])

    const project = await screen.findByRole('region', {
      name: 'Workout tracker',
    })
    expect(within(project).getByText(/No next step yet/)).toBeVisible()
  })

  it('adds a task to a project with all its fields', async () => {
    createTask.mockResolvedValue(chart)
    const user = renderPage([])

    const project = await screen.findByRole('region', {
      name: 'Workout tracker',
    })
    await user.click(within(project).getByRole('button', { name: 'Add task' }))

    // The project is preselected from the section the form was opened in.
    expect(within(project).getByLabelText('Project')).toHaveValue('tracker')

    await user.type(
      within(project).getByLabelText('Task'),
      'Make the basic chart work',
    )
    await user.click(within(project).getByRole('button', { name: '45' }))
    await user.click(within(project).getByRole('radio', { name: 'High' }))
    await user.click(within(project).getByRole('radio', { name: 'Essential' }))
    await user.type(within(project).getByLabelText(/Due date/), '2026-10-03')
    await user.type(
      within(project).getByLabelText(/Smaller version/),
      'Sketch the chart on paper',
    )
    await user.click(within(project).getByRole('button', { name: 'Add task' }))

    expect(createTask).toHaveBeenCalledWith({
      title: 'Make the basic chart work',
      project_id: 'tracker',
      estimated_minutes: 45,
      energy: 'high',
      importance: 3,
      due_date: '2026-10-03',
      smaller_version: 'Sketch the chart on paper',
    })
  })

  it('adds a standalone chore with sensible defaults', async () => {
    createTask.mockResolvedValue(laundry)
    const user = renderPage([])

    const chores = await screen.findByRole('region', {
      name: 'Chores & obligations',
    })
    await user.click(within(chores).getByRole('button', { name: 'Add task' }))
    await user.type(within(chores).getByLabelText('Task'), 'Laundry{Enter}')

    expect(createTask).toHaveBeenCalledWith({
      title: 'Laundry',
      project_id: null,
      estimated_minutes: 25,
      energy: 'medium',
      importance: 2,
      due_date: null,
      smaller_version: null,
    })
  })

  it('adds several tasks to a project at once, one per line', async () => {
    createTasks.mockResolvedValue([])
    const user = renderPage([])

    const project = await screen.findByRole('region', {
      name: 'Workout tracker',
    })
    await user.click(
      within(project).getByRole('button', { name: 'Add several' }),
    )
    const addButton = within(project).getByRole('button', {
      name: 'Add tasks',
    })
    expect(addButton).toBeDisabled()

    await user.type(
      within(project).getByLabelText('Tasks for Workout tracker'),
      '- Sketch the chart{Enter}{Enter}- Add labels{Enter}Pick colours',
    )
    await user.click(within(project).getByRole('button', { name: '10' }))
    await user.click(within(project).getByRole('radio', { name: 'Low' }))
    await user.click(
      within(project).getByRole('button', { name: 'Add 3 tasks' }),
    )

    const shared = {
      project_id: 'tracker',
      estimated_minutes: 10,
      energy: 'low',
      importance: 2,
    }
    expect(createTasks).toHaveBeenCalledWith([
      { title: 'Sketch the chart', ...shared },
      { title: 'Add labels', ...shared },
      { title: 'Pick colours', ...shared },
    ])
    expect(await within(project).findByRole('status')).toHaveTextContent(
      'Added 3 tasks',
    )
  })

  it('adds several chores at once', async () => {
    createTasks.mockResolvedValue([])
    const user = renderPage([])

    const chores = await screen.findByRole('region', {
      name: 'Chores & obligations',
    })
    await user.click(
      within(chores).getByRole('button', { name: 'Add several' }),
    )
    await user.type(
      within(chores).getByLabelText('Chores & obligations'),
      'Laundry{Enter}Dishes',
    )
    await user.click(
      within(chores).getByRole('button', { name: 'Add 2 tasks' }),
    )

    expect(createTasks).toHaveBeenCalledWith([
      expect.objectContaining({ title: 'Laundry', project_id: null }),
      expect.objectContaining({ title: 'Dishes', project_id: null }),
    ])
  })

  it('edits a task and can move it to a project', async () => {
    updateTask.mockResolvedValue(laundry)
    const user = renderPage([laundry])

    const item = (await screen.findByText('Laundry')).closest('li')!
    await user.click(within(item).getByRole('button', { name: 'Edit' }))
    await user.selectOptions(
      within(item).getByLabelText('Project'),
      'Workout tracker',
    )
    await user.click(within(item).getByRole('button', { name: 'Save' }))

    expect(updateTask).toHaveBeenCalledWith(
      laundry.id,
      expect.objectContaining({ title: 'Laundry', project_id: 'tracker' }),
    )
  })

  it('asks before deleting a task', async () => {
    deleteTask.mockResolvedValue()
    const user = renderPage([laundry])

    const item = (await screen.findByText('Laundry')).closest('li')!
    await user.click(within(item).getByRole('button', { name: 'Delete' }))
    expect(deleteTask).not.toHaveBeenCalled()

    await user.click(within(item).getByRole('button', { name: 'Delete' }))
    expect(deleteTask).toHaveBeenCalledWith(laundry.id)
  })
})
