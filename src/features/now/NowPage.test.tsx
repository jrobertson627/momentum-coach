// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as projectsApi from '../../lib/projects'
import * as tasksApi from '../../lib/tasks'
import type { Task } from '../../lib/tasks'
import { NowPage } from './NowPage'

vi.mock('../../lib/tasks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/tasks')>()
  return { ...actual, fetchOpenTasks: vi.fn() }
})
vi.mock('../../lib/projects', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/projects')>()
  return { ...actual, fetchProjects: vi.fn() }
})

const fetchOpenTasks = vi.mocked(tasksApi.fetchOpenTasks)
const fetchProjects = vi.mocked(projectsApi.fetchProjects)

function task(title: string, overrides: Partial<Task> = {}): Task {
  return {
    id: title,
    user_id: 'user',
    project_id: null,
    title,
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

function renderPage(tasks: Task[]) {
  fetchOpenTasks.mockResolvedValue(tasks)
  fetchProjects.mockResolvedValue([])
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const view = render(
    <QueryClientProvider client={client}>
      <NowPage />
    </QueryClientProvider>,
  )
  return { user: userEvent.setup(), ...view }
}

beforeEach(() => {
  vi.resetAllMocks()
  sessionStorage.clear()
})

describe('NowPage', () => {
  it('goes from check-in to what fits in two taps', async () => {
    const { user } = renderPage([
      task('Laundry', { estimated_minutes: 20, energy: 'low' }),
      task('Deep work', { estimated_minutes: 90, energy: 'high' }),
    ])

    expect(screen.getByRole('heading', { name: 'What now?' })).toBeVisible()
    await user.click(screen.getByRole('radio', { name: '25 min' }))
    await user.click(screen.getByRole('radio', { name: 'Low' }))

    expect(screen.getByText('25 minutes and low energy')).toBeVisible()
    expect(await screen.findByText('Laundry')).toBeVisible()
    expect(screen.queryByText('Deep work')).not.toBeInTheDocument()
  })

  it('works in either order', async () => {
    const { user } = renderPage([])

    await user.click(screen.getByRole('radio', { name: 'High' }))
    expect(screen.getByRole('heading', { name: 'What now?' })).toBeVisible()

    await user.click(screen.getByRole('radio', { name: '60+ min' }))
    expect(screen.getByText('an hour or more and high energy')).toBeVisible()
  })

  it('is gentle when nothing fits', async () => {
    const { user } = renderPage([
      task('Deep work', { estimated_minutes: 90, energy: 'high' }),
    ])

    await user.click(screen.getByRole('radio', { name: '10 min' }))
    await user.click(screen.getByRole('radio', { name: 'Low' }))

    expect(await screen.findByText(/rest counts too/)).toBeVisible()
  })

  it('can change the check-in, or keep it', async () => {
    const { user } = renderPage([])

    await user.click(screen.getByRole('radio', { name: '25 min' }))
    await user.click(screen.getByRole('radio', { name: 'Low' }))
    await user.click(screen.getByRole('button', { name: 'Change' }))

    // The current answers are preselected.
    expect(screen.getByRole('radio', { name: '25 min' })).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Keep as is' }))
    expect(screen.getByText('25 minutes and low energy')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Change' }))
    await user.click(screen.getByRole('radio', { name: '45 min' }))
    expect(screen.getByText('45 minutes and low energy')).toBeVisible()
  })

  it('remembers the check-in for the session', async () => {
    const first = renderPage([])
    await first.user.click(screen.getByRole('radio', { name: '45 min' }))
    await first.user.click(screen.getByRole('radio', { name: 'Medium' }))
    first.unmount()

    renderPage([])
    expect(screen.getByText('45 minutes and medium energy')).toBeVisible()
  })
})
