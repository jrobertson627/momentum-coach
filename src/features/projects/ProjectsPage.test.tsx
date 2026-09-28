// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as ideasApi from '../../lib/ideas'
import * as api from '../../lib/projects'
import type { Project } from '../../lib/projects'
import { ProjectsPage } from './ProjectsPage'

vi.mock('../../lib/projects', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/projects')>()
  return {
    ...actual,
    fetchProjects: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn(),
  }
})

vi.mock('../../lib/ideas', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/ideas')>()
  return { ...actual, createIdea: vi.fn() }
})

const fetchProjects = vi.mocked(api.fetchProjects)
const createProject = vi.mocked(api.createProject)
const updateProject = vi.mocked(api.updateProject)
const createIdea = vi.mocked(ideasApi.createIdea)

let nextId = 0
function project(overrides: Partial<Project>): Project {
  return {
    id: `p${nextId++}`,
    user_id: 'user',
    name: 'Project',
    why: null,
    definition_of_done: null,
    status: 'active',
    finished_at: null,
    created_at: '2026-09-27T00:00:00Z',
    updated_at: '2026-09-27T00:00:00Z',
    ...overrides,
  }
}

const threeActive = [
  project({
    name: 'Workout tracker',
    definition_of_done: 'Weekly chart works',
  }),
  project({ name: 'Pixel art game' }),
  project({ name: 'Garden plan' }),
]

function renderPage(projects: Project[]) {
  fetchProjects.mockResolvedValue(projects)
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <ProjectsPage />
    </QueryClientProvider>,
  )
  return userEvent.setup()
}

async function fillNewProject(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  done = '',
) {
  await user.click(await screen.findByRole('button', { name: 'New project' }))
  await user.type(screen.getByLabelText('Name'), name)
  if (done) await user.type(screen.getByLabelText('Done when…'), done)
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('ProjectsPage', () => {
  it('shows the active count and each definition of done', async () => {
    renderPage(threeActive)

    expect(await screen.findByText('3 of 3')).toBeInTheDocument()
    expect(screen.getByText('Weekly chart works')).toBeInTheDocument()
    // Projects without a finish line get a nudge to add one.
    expect(
      screen.getAllByRole('button', { name: 'Add a definition of done' }),
    ).toHaveLength(2)
  })

  it('starts a new active project when there is room', async () => {
    createProject.mockResolvedValue(project({ name: 'Learn Rust' }))
    const user = renderPage([])

    await fillNewProject(user, 'Learn Rust', 'Finish chapter 10')
    await user.click(screen.getByRole('button', { name: 'Start project' }))

    expect(createProject).toHaveBeenCalledWith({
      name: 'Learn Rust',
      why: null,
      definition_of_done: 'Finish chapter 10',
      status: 'active',
    })
  })

  describe('at the 3-project limit', () => {
    it('explains the limit and offers to park the idea instead', async () => {
      createIdea.mockResolvedValue({} as ideasApi.Idea)
      const user = renderPage(threeActive)

      await fillNewProject(user, 'Learn Rust', 'Finish chapter 10')

      expect(screen.getByRole('alert')).toHaveTextContent(
        'You already have 3 active projects',
      )
      expect(
        screen.queryByRole('button', { name: 'Start project' }),
      ).not.toBeInTheDocument()

      await user.click(
        screen.getByRole('button', { name: 'Park it as an idea' }),
      )

      expect(createIdea).toHaveBeenCalledWith(
        'Learn Rust',
        'Done when: Finish chapter 10',
      )
      expect(createProject).not.toHaveBeenCalled()
      expect(await screen.findByRole('status')).toHaveTextContent(
        '“Learn Rust” is saved in your ideas',
      )
    })

    it('can save the new project as paused instead', async () => {
      createProject.mockResolvedValue(project({ status: 'paused' }))
      const user = renderPage(threeActive)

      await fillNewProject(user, 'Learn Rust')
      await user.click(screen.getByRole('button', { name: 'Save as paused' }))

      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Learn Rust', status: 'paused' }),
      )
    })

    it('does not resume a paused project and says why', async () => {
      const user = renderPage([
        ...threeActive,
        project({ name: 'Old blog', status: 'paused' }),
      ])

      const paused = (await screen.findByText('Old blog')).closest('li')!
      await user.click(within(paused).getByRole('button', { name: 'Resume' }))

      expect(within(paused).getByRole('alert')).toHaveTextContent(
        'Pause or finish one of them first',
      )
      expect(updateProject).not.toHaveBeenCalled()
    })

    it('switches to the limit options if the server rejects a 4th project', async () => {
      // e.g. a project was started on another device since the page loaded
      createProject.mockRejectedValue(new api.ActiveLimitError())
      const user = renderPage(threeActive.slice(0, 2))

      await fillNewProject(user, 'Learn Rust')
      await user.click(screen.getByRole('button', { name: 'Start project' }))

      expect(
        await screen.findByRole('button', { name: 'Park it as an idea' }),
      ).toBeInTheDocument()
    })
  })

  it('marks a project finished with a timestamp', async () => {
    updateProject.mockResolvedValue(threeActive[0])
    const user = renderPage(threeActive)

    const card = (await screen.findByText('Workout tracker')).closest('li')!
    await user.click(
      within(card).getByRole('button', { name: 'Mark finished' }),
    )

    expect(updateProject).toHaveBeenCalledWith(threeActive[0].id, {
      status: 'finished',
      finished_at: expect.any(String),
    })
  })

  it('edits a project in place', async () => {
    updateProject.mockResolvedValue(threeActive[1])
    const user = renderPage(threeActive)

    const card = (await screen.findByText('Pixel art game')).closest('li')!
    await user.click(within(card).getByRole('button', { name: 'Edit' }))
    await user.type(within(card).getByLabelText('Done when…'), 'One level')
    await user.click(within(card).getByRole('button', { name: 'Save' }))

    expect(updateProject).toHaveBeenCalledWith(threeActive[1].id, {
      name: 'Pixel art game',
      why: null,
      definition_of_done: 'One level',
    })
  })

  it('keeps archived projects out of the way until asked', async () => {
    const user = renderPage([project({ name: 'Old idea', status: 'archived' })])

    const toggle = await screen.findByRole('button', {
      name: 'Show archived (1)',
    })
    expect(screen.queryByText('Old idea')).not.toBeInTheDocument()

    await user.click(toggle)
    expect(screen.getByText('Old idea')).toBeInTheDocument()
  })
})
