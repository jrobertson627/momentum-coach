import { describe, expect, it } from 'vitest'
import { describeCheckIn, PLENTY_OF_TIME, tasksThatFit } from './checkIn'
import type { Project } from './projects'
import type { Task } from './tasks'

function project(id: string, status: Project['status']): Project {
  return {
    id,
    user_id: 'user',
    name: id,
    why: null,
    definition_of_done: null,
    status,
    finished_at: null,
    created_at: '',
    updated_at: '',
  }
}

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

const now = new Date('2026-09-28T12:00:00Z')
const projects = [project('active', 'active'), project('paused', 'paused')]

function titles(tasks: Task[]) {
  return tasks.map((t) => t.title)
}

describe('tasksThatFit', () => {
  it('keeps tasks that fit the time available', () => {
    const tasks = [
      task('short', { estimated_minutes: 10 }),
      task('exact', { estimated_minutes: 25 }),
      task('long', { estimated_minutes: 26 }),
    ]
    expect(
      titles(
        tasksThatFit(tasks, projects, { minutes: 25, energy: 'high' }, now),
      ),
    ).toEqual(['short', 'exact'])
  })

  it('never asks for more energy than you have', () => {
    const tasks = [
      task('low', { energy: 'low' }),
      task('medium', { energy: 'medium' }),
      task('high', { energy: 'high' }),
    ]
    const at = (energy: Task['energy']) =>
      titles(tasksThatFit(tasks, projects, { minutes: 60, energy }, now))

    expect(at('low')).toEqual(['low'])
    expect(at('medium')).toEqual(['low', 'medium'])
    expect(at('high')).toEqual(['low', 'medium', 'high'])
  })

  it('only includes chores and tasks of active projects', () => {
    const tasks = [
      task('chore'),
      task('active project', { project_id: 'active' }),
      task('paused project', { project_id: 'paused' }),
    ]
    expect(
      titles(
        tasksThatFit(tasks, projects, { minutes: 60, energy: 'high' }, now),
      ),
    ).toEqual(['chore', 'active project'])
  })

  it('skips tasks deferred until later, and done tasks', () => {
    const tasks = [
      task('deferred', { deferred_until: '2026-09-29T00:00:00Z' }),
      task('defer over', { deferred_until: '2026-09-28T08:00:00Z' }),
      task('done', { status: 'done' }),
    ]
    expect(
      titles(
        tasksThatFit(tasks, projects, { minutes: 60, energy: 'high' }, now),
      ),
    ).toEqual(['defer over'])
  })
})

describe('describeCheckIn', () => {
  it('reads naturally', () => {
    expect(describeCheckIn({ minutes: 25, energy: 'low' })).toBe(
      '25 minutes and low energy',
    )
    expect(describeCheckIn({ minutes: PLENTY_OF_TIME, energy: 'high' })).toBe(
      'an hour or more and high energy',
    )
  })
})
