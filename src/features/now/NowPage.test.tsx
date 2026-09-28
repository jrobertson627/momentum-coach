// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as actionsApi from '../../lib/actions'
import * as eventsApi from '../../lib/events'
import * as gameTimeApi from '../../lib/gameTime'
import * as projectsApi from '../../lib/projects'
import * as tasksApi from '../../lib/tasks'
import type { Task } from '../../lib/tasks'
import { NowPage } from './NowPage'

vi.mock('../../lib/tasks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/tasks')>()
  return { ...actual, fetchOpenTasks: vi.fn(), createTask: vi.fn() }
})
vi.mock('../../lib/events', () => ({ fetchRecentEvents: vi.fn() }))
vi.mock('../../lib/gameTime', () => ({
  fetchGameTimeBalance: vi.fn(),
  spendGameTime: vi.fn(),
}))
vi.mock('../../lib/actions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/actions')>()
  return { ...actual, actOnTask: vi.fn() }
})
vi.mock('../../lib/projects', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/projects')>()
  return { ...actual, fetchProjects: vi.fn() }
})

const fetchOpenTasks = vi.mocked(tasksApi.fetchOpenTasks)
const fetchProjects = vi.mocked(projectsApi.fetchProjects)
const fetchRecentEvents = vi.mocked(eventsApi.fetchRecentEvents)
const actOnTask = vi.mocked(actionsApi.actOnTask)
const createTask = vi.mocked(tasksApi.createTask)
const fetchGameTimeBalance = vi.mocked(gameTimeApi.fetchGameTimeBalance)
const spendGameTime = vi.mocked(gameTimeApi.spendGameTime)

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

function renderPage(
  tasks: Task[],
  projects: projectsApi.Project[] = [],
  balance = 0,
) {
  fetchGameTimeBalance.mockResolvedValue(balance)
  fetchOpenTasks.mockResolvedValue(tasks)
  fetchProjects.mockResolvedValue(projects)
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

  describe('acting on the pick', () => {
    const tracker: projectsApi.Project = {
      id: 'tracker',
      user_id: 'user',
      name: 'Workout tracker',
      why: null,
      definition_of_done: null,
      status: 'active',
      finished_at: null,
      created_at: '2026-09-27T00:00:00Z',
      updated_at: '',
    }
    const chart = task('Make the chart', {
      project_id: 'tracker',
      importance: 3,
    })
    const laundry = task('Laundry', { energy: 'low', importance: 1 })

    async function checkIn(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole('radio', { name: '25 min' }))
      await user.click(screen.getByRole('radio', { name: 'Medium' }))
      return screen.findByRole('region', { name: 'Your next step' })
    }

    it('completes a project task and asks for its next step', async () => {
      actOnTask.mockResolvedValue({ ...chart, status: 'done' })
      createTask.mockResolvedValue(task('Add labels'))
      const { user } = renderPage([chart, laundry], [tracker])
      await checkIn(user)

      await user.click(screen.getByRole('button', { name: 'Done' }))

      expect(actOnTask).toHaveBeenCalledWith(
        'Make the chart',
        { kind: 'completed' },
        { minutes: 25, energy: 'medium' },
      )
      expect(await screen.findByText('Nice work.')).toBeVisible()
      // 25 min of effort earns 13 min of game time.
      expect(screen.getByText('+13 min of game time')).toBeVisible()

      await user.type(
        screen.getByLabelText('What’s the next step for Workout tracker?'),
        'Add labels{Enter}',
      )
      expect(createTask).toHaveBeenCalledWith({
        title: 'Add labels',
        project_id: 'tracker',
      })
      // Back to recommendations.
      expect(
        await screen.findByRole('region', { name: 'Your next step' }),
      ).toBeVisible()
    })

    it('finishing a smaller version is a first step, not the whole task', async () => {
      const report = task('Write the report', {
        estimated_minutes: 120,
        smaller_version: 'Write three bullet points',
      })
      actOnTask.mockResolvedValue({ ...report, smaller_version: null })
      const { user } = renderPage([report])
      await user.click(screen.getByRole('radio', { name: '10 min' }))
      await user.click(screen.getByRole('radio', { name: 'Medium' }))
      await screen.findByRole('region', { name: 'Start small' })

      await user.click(screen.getByRole('button', { name: 'Done' }))

      expect(actOnTask).toHaveBeenCalledWith(
        'Write the report',
        { kind: 'progressed' },
        { minutes: 10, energy: 'medium' },
      )
      const panel = await screen.findByRole('region', {
        name: 'First step done',
      })
      expect(panel).toHaveTextContent(
        '“Write three bullet points” is done. “Write the report” stays on your list',
      )
      expect(panel).toHaveTextContent('+5 min of game time')
      expect(
        screen.queryByLabelText(/What’s the next step/),
      ).not.toBeInTheDocument()
    })

    it('finishing a chore just moves on', async () => {
      actOnTask.mockResolvedValue({ ...laundry, status: 'done' })
      const { user } = renderPage([laundry])
      await checkIn(user)

      await user.click(screen.getByRole('button', { name: 'Done' }))
      await user.click(
        await screen.findByRole('button', { name: 'What’s next?' }),
      )

      expect(createTask).not.toHaveBeenCalled()
      expect(screen.queryByText('Nice work.')).not.toBeInTheDocument()
    })

    it('skips and shows something else', async () => {
      const { user } = renderPage([chart, laundry], [tracker])
      await checkIn(user)
      actOnTask.mockResolvedValue(chart)
      // After the skip, the refetched history includes it.
      fetchRecentEvents.mockResolvedValue([
        {
          task_id: 'Make the chart',
          project_id: 'tracker',
          kind: 'skipped',
          created_at: new Date().toISOString(),
        },
      ])

      await user.click(screen.getByRole('button', { name: 'Skip' }))

      expect(actOnTask).toHaveBeenCalledWith(
        'Make the chart',
        { kind: 'skipped' },
        { minutes: 25, energy: 'medium' },
      )
      expect(await screen.findByRole('status')).toHaveTextContent(
        'Skipped “Make the chart”',
      )
      expect(
        await screen.findByRole('region', { name: 'Your next step' }),
      ).toHaveTextContent('Laundry')
    })

    it('defers until tomorrow', async () => {
      actOnTask.mockResolvedValue(chart)
      const { user } = renderPage([chart], [tracker])
      await checkIn(user)

      await user.click(screen.getByRole('button', { name: 'Later' }))
      await user.click(screen.getByRole('button', { name: 'Tomorrow' }))

      expect(actOnTask).toHaveBeenCalledWith(
        'Make the chart',
        { kind: 'deferred', until: actionsApi.startOfDayIn(1) },
        { minutes: 25, energy: 'medium' },
      )
      expect(await screen.findByRole('status')).toHaveTextContent(
        '“Make the chart” will be back',
      )
    })

    it('defers to a chosen date', async () => {
      actOnTask.mockResolvedValue(chart)
      const { user } = renderPage([chart], [tracker])
      await checkIn(user)

      await user.click(screen.getByRole('button', { name: 'Later' }))
      await user.type(screen.getByLabelText('On'), '2030-01-15')
      await user.click(screen.getByRole('button', { name: 'Set' }))

      expect(actOnTask).toHaveBeenCalledWith(
        'Make the chart',
        { kind: 'deferred', until: new Date(2030, 0, 15) },
        { minutes: 25, energy: 'medium' },
      )
    })

    it('shows an error if the action fails', async () => {
      actOnTask.mockRejectedValue(new Error('Task not found'))
      const { user } = renderPage([chart], [tracker])
      await checkIn(user)

      await user.click(screen.getByRole('button', { name: 'Done' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Task not found',
      )
    })
  })

  describe('game time', () => {
    it('shows the balance on the home screen', async () => {
      renderPage([], [], 95)
      expect(
        await screen.findByRole('region', { name: 'Game time' }),
      ).toHaveTextContent('Game time: 1 h 35 min')
    })

    it('encourages earning some when the balance is empty', async () => {
      renderPage([], [], 0)
      expect(
        await screen.findByText('Finish a task to earn some.'),
      ).toBeVisible()
      expect(
        screen.queryByRole('button', { name: 'Play' }),
      ).not.toBeInTheDocument()
    })

    it('spends game time, with an optional note', async () => {
      spendGameTime.mockResolvedValue()
      const { user } = renderPage([], [], 40)

      await user.click(await screen.findByRole('button', { name: 'Play' }))
      // More than the balance can't be chosen.
      expect(screen.getByRole('button', { name: '60 min' })).toBeDisabled()
      await user.click(screen.getByRole('button', { name: '30 min' }))
      await user.type(screen.getByLabelText(/What are you playing/), 'Stardew')
      await user.click(screen.getByRole('button', { name: 'Start playing' }))

      expect(spendGameTime).toHaveBeenCalledWith(30, 'Stardew')
      expect(await screen.findByRole('status')).toHaveTextContent(
        'Enjoy 30 min of Stardew. You earned it.',
      )
    })

    it('won’t start with more minutes than the balance', async () => {
      const { user } = renderPage([], [], 20)

      await user.click(await screen.findByRole('button', { name: 'Play' }))
      await user.type(screen.getByLabelText('Minutes'), '25')

      expect(
        screen.getByRole('button', { name: 'Start playing' }),
      ).toBeDisabled()
    })

    it('shows the database’s refusal kindly', async () => {
      spendGameTime.mockRejectedValue(
        new Error('That’s more game time than you have right now.'),
      )
      const { user } = renderPage([], [], 20)

      await user.click(await screen.findByRole('button', { name: 'Play' }))
      await user.click(screen.getByRole('button', { name: '15 min' }))
      await user.click(screen.getByRole('button', { name: 'Start playing' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'more game time than you have',
      )
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
