// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as ideasApi from '../../lib/ideas'
import type { Idea } from '../../lib/ideas'
import * as projectsApi from '../../lib/projects'
import type { Project } from '../../lib/projects'
import { IdeasPage } from './IdeasPage'
import { QuickCapture } from './QuickCapture'

vi.mock('../../lib/ideas', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/ideas')>()
  return {
    ...actual,
    fetchIdeas: vi.fn(),
    createIdea: vi.fn(),
    deleteIdea: vi.fn(),
    promoteIdea: vi.fn(),
  }
})
vi.mock('../../lib/projects', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/projects')>()
  return { ...actual, fetchProjects: vi.fn() }
})

const fetchIdeas = vi.mocked(ideasApi.fetchIdeas)
const createIdea = vi.mocked(ideasApi.createIdea)
const deleteIdea = vi.mocked(ideasApi.deleteIdea)
const promoteIdea = vi.mocked(ideasApi.promoteIdea)
const fetchProjects = vi.mocked(projectsApi.fetchProjects)

function idea(overrides: Partial<Idea>): Idea {
  return {
    id: crypto.randomUUID(),
    user_id: 'user',
    text: 'Idea',
    notes: null,
    promoted_project_id: null,
    created_at: '2026-09-27T12:00:00Z',
    updated_at: '2026-09-27T12:00:00Z',
    ...overrides,
  }
}

function activeProjects(n: number): Project[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    user_id: 'user',
    name: `Project ${i}`,
    why: null,
    definition_of_done: null,
    status: 'active',
    finished_at: null,
    created_at: '2026-09-27T00:00:00Z',
    updated_at: '2026-09-27T00:00:00Z',
  }))
}

function renderWithClient(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
  return userEvent.setup()
}

const rust = idea({
  text: 'Learn Rust',
  notes: 'Done when: Finish chapter 10',
})

beforeEach(() => {
  vi.resetAllMocks()
})

describe('IdeasPage', () => {
  it('lists parked ideas with their finish line', async () => {
    fetchIdeas.mockResolvedValue([rust, idea({ text: 'Pottery class' })])
    fetchProjects.mockResolvedValue([])
    renderWithClient(<IdeasPage />)

    expect(await screen.findByText('Learn Rust')).toBeInTheDocument()
    expect(screen.getByText('Finish chapter 10')).toBeInTheDocument()
    expect(screen.getByText('Pottery class')).toBeInTheDocument()
  })

  it('shows a calm empty state', async () => {
    fetchIdeas.mockResolvedValue([])
    fetchProjects.mockResolvedValue([])
    renderWithClient(<IdeasPage />)

    expect(await screen.findByText(/Nothing parked/)).toBeInTheDocument()
  })

  it('promotes an idea to an active project, prefilled from the idea', async () => {
    fetchIdeas.mockResolvedValue([rust])
    fetchProjects.mockResolvedValue(activeProjects(2))
    promoteIdea.mockResolvedValue(activeProjects(1)[0])
    const user = renderWithClient(<IdeasPage />)

    await user.click(
      await screen.findByRole('button', { name: 'Start as project' }),
    )
    expect(screen.getByLabelText('Name')).toHaveValue('Learn Rust')
    expect(screen.getByLabelText('Done when…')).toHaveValue('Finish chapter 10')

    await user.click(screen.getByRole('button', { name: 'Start project' }))

    expect(promoteIdea).toHaveBeenCalledWith(rust.id, {
      name: 'Learn Rust',
      why: null,
      definition_of_done: 'Finish chapter 10',
      status: 'active',
    })
    expect(await screen.findByRole('status')).toHaveTextContent(
      '“Learn Rust” is now an active project',
    )
  })

  it('does not allow promoting while 3 projects are active', async () => {
    fetchIdeas.mockResolvedValue([rust])
    fetchProjects.mockResolvedValue(activeProjects(3))
    renderWithClient(<IdeasPage />)

    expect(
      await screen.findByRole('button', { name: 'Start as project' }),
    ).toBeDisabled()
    expect(screen.getByText(/All 3 project slots are full/)).toBeInTheDocument()
  })

  it('explains if the server rejects the promotion at the limit', async () => {
    fetchIdeas.mockResolvedValue([rust])
    fetchProjects.mockResolvedValue(activeProjects(2))
    promoteIdea.mockRejectedValue(new projectsApi.ActiveLimitError())
    const user = renderWithClient(<IdeasPage />)

    await user.click(
      await screen.findByRole('button', { name: 'Start as project' }),
    )
    await user.click(screen.getByRole('button', { name: 'Start project' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This idea will stay parked',
    )
  })

  it('asks before letting go of an idea', async () => {
    fetchIdeas.mockResolvedValue([rust])
    fetchProjects.mockResolvedValue([])
    deleteIdea.mockResolvedValue()
    const user = renderWithClient(<IdeasPage />)

    const card = (await screen.findByText('Learn Rust')).closest('li')!
    await user.click(within(card).getByRole('button', { name: 'Let go' }))
    expect(deleteIdea).not.toHaveBeenCalled()

    await user.click(within(card).getByRole('button', { name: 'Let go' }))
    expect(deleteIdea).toHaveBeenCalledWith(rust.id)
  })
})

describe('QuickCapture', () => {
  it('parks an idea in one field and gets out of the way', async () => {
    createIdea.mockResolvedValue(idea({ text: 'Build a synth' }))
    const user = renderWithClient(<QuickCapture />)

    await user.click(screen.getByRole('button', { name: 'Park an idea' }))
    await user.keyboard('Build a synth{Enter}')

    expect(createIdea).toHaveBeenCalledWith('Build a synth', undefined)
    expect(await screen.findByRole('status')).toHaveTextContent('Parked')
    expect(screen.queryByLabelText('New idea')).not.toBeInTheDocument()
  })

  it('closes on Escape without saving', async () => {
    const user = renderWithClient(<QuickCapture />)

    await user.click(screen.getByRole('button', { name: 'Park an idea' }))
    await user.keyboard('Half a thought{Escape}')

    expect(screen.queryByLabelText('New idea')).not.toBeInTheDocument()
    expect(createIdea).not.toHaveBeenCalled()
  })
})
