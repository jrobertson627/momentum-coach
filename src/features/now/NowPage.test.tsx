// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as eventsApi from '../../lib/events'
import * as projectsApi from '../../lib/projects'
import * as tasksApi from '../../lib/tasks'
import type { Task } from '../../lib/tasks'
import { NowPage } from './NowPage'

vi.mock('../../lib/tasks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/tasks')>()
  return { ...actual, fetchOpenTasks: vi.fn() }
})
vi.mock('../../lib/events', () => ({ fetchRecentEvents: vi.fn() }))
vi.mock('../../lib/projects', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/projects')>()
  return { ...actual, fetchProjects: vi.fn() }
})

const fetchOpenTasks = vi.mocked(tasksApi.fetchOpenTasks)
const fetchProjects = vi.mocked(projectsApi.fetchProjects)
const fetchRecentEvents = vi.mocked(eventsApi.fetchRecentEvents)

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
  fetchRecentEvents.mockResolvedValue([])
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

  it('recommends one task and tucks the rest under other options', async () => {
    const { user } = renderPage([
      task('Laundry', { estimated_minutes: 20, energy: 'low', importance: 1 }),
      task('Renew registration', {
        estimated_minutes: 15,
        energy: 'low',
        importance: 3,
      }),
    ])

    await user.click(screen.getByRole('radio', { name: '25 min' }))
    await user.click(screen.getByRole('radio', { name: 'Low' }))

    const pick = await screen.findByRole('region', { name: 'Your next step' })
    expect(pick).toHaveTextContent('Renew registration')
    expect(pick).not.toHaveTextContent('Laundry')
    expect(pick).toHaveTextContent(
      'Recommended because it is essential, matches your energy, and fits your 25 minutes.',
    )

    await user.click(screen.getByText('Other options (1)'))
    expect(screen.getByText('Laundry')).toBeVisible()
  })

  it('suggests the smaller version when the whole task is too big', async () => {
    const { user } = renderPage([
      task('Write the report', {
        estimated_minutes: 120,
        smaller_version: 'Write three bullet points',
      }),
    ])

    await user.click(screen.getByRole('radio', { name: '10 min' }))
    await user.click(screen.getByRole('radio', { name: 'Medium' }))

    const pick = await screen.findByRole('region', { name: 'Start small' })
    expect(pick).toHaveTextContent('Write three bullet points')
    expect(pick).toHaveTextContent('A first step toward “Write the report”')
  })

  describe('too much right now', () => {
    const tasks = () => [
      task('Write the report', {
        energy: 'high',
        importance: 3,
        smaller_version: 'Write three bullet points',
      }),
      task('Tidy the desk', { energy: 'medium', importance: 1 }),
      task('Water plants', {
        energy: 'low',
        estimated_minutes: 5,
        importance: 1,
      }),
    ]

    async function checkIn(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole('radio', { name: '45 min' }))
      await user.click(screen.getByRole('radio', { name: 'High' }))
      await screen.findByRole('region', { name: 'Your next step' })
    }

    it('steps down: the smaller version first, then only lighter tasks', async () => {
      const { user } = renderPage(tasks())
      await checkIn(user)
      const tooMuch = () =>
        user.click(screen.getByRole('button', { name: 'Too much right now' }))

      await tooMuch()
      expect(
        screen.getByRole('region', { name: 'Start small' }),
      ).toHaveTextContent('Write three bullet points')

      await tooMuch()
      expect(
        screen.getByRole('region', { name: 'Something lighter' }),
      ).toHaveTextContent('Water plants')
    })

    it('says so kindly when nothing is lighter, and can go back', async () => {
      const { user } = renderPage(tasks())
      await checkIn(user)
      const tooMuch = () =>
        user.click(screen.getByRole('button', { name: 'Too much right now' }))

      await tooMuch()
      await tooMuch()
      await tooMuch()

      expect(screen.getByRole('status')).toHaveTextContent(
        'It’s okay to take a break instead.',
      )
      expect(
        screen.queryByRole('button', { name: 'Too much right now' }),
      ).not.toBeInTheDocument()

      await user.click(
        screen.getByRole('button', { name: 'Back to the first suggestion' }),
      )
      expect(
        screen.getByRole('region', { name: 'Your next step' }),
      ).toHaveTextContent('Write the report')
    })
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
