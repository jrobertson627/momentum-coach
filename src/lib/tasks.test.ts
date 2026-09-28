import { describe, expect, it } from 'vitest'
import type { Project } from './projects'
import { describeTask, formatMinutes, groupTasks, type Task } from './tasks'

function project(name: string, status: Project['status']): Project {
  return {
    id: name,
    user_id: 'user',
    name,
    why: null,
    definition_of_done: null,
    status,
    finished_at: null,
    created_at: '',
    updated_at: '',
  }
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

describe('groupTasks', () => {
  const active = project('Tracker', 'active')
  const emptyActive = project('Garden', 'active')
  const paused = project('Blog', 'paused')
  const emptyPaused = project('Quilt', 'paused')
  const finished = project('Recipes', 'finished')
  const projects = [paused, active, finished, emptyActive, emptyPaused]

  const chart = task({ title: 'Chart', project_id: 'Tracker' })
  const theme = task({ title: 'Theme', project_id: 'Blog' })
  const leftover = task({ title: 'Leftover', project_id: 'Recipes' })
  const laundry = task({ title: 'Laundry' })

  const groups = groupTasks([chart, theme, leftover, laundry], projects)

  it('orders active projects, then paused, then standalone chores', () => {
    expect(groups.map((g) => g.project?.name ?? 'chores')).toEqual([
      'Tracker',
      'Garden',
      'Blog',
      'chores',
    ])
  })

  it('keeps empty active projects but hides empty paused ones', () => {
    expect(groups.find((g) => g.project === emptyActive)?.tasks).toEqual([])
    expect(groups.some((g) => g.project === emptyPaused)).toBe(false)
  })

  it('leaves out tasks of finished projects', () => {
    expect(groups.flatMap((g) => g.tasks)).not.toContain(leftover)
    expect(groups.at(-1)!.tasks).toEqual([laundry])
  })
})

describe('describeTask', () => {
  it('summarises time, energy, importance and due date', () => {
    expect(
      describeTask(
        task({
          estimated_minutes: 90,
          energy: 'low',
          importance: 3,
          due_date: '2026-10-03',
        }),
      ),
    ).toBe('1 h 30 min · Low energy · Essential · Due Oct 3')
  })

  it('leaves out the due date when there is none', () => {
    expect(describeTask(task({}))).toBe('25 min · Medium energy · Important')
  })
})

describe('formatMinutes', () => {
  it.each([
    [10, '10 min'],
    [60, '1 h'],
    [125, '2 h 5 min'],
  ])('%i → %s', (minutes, text) => {
    expect(formatMinutes(minutes)).toBe(text)
  })
})
