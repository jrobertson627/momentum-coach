import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CONFIG,
  rankTasks,
  recommend,
  type CheckIn,
  type EngineEvent,
  type EngineProject,
  type EngineTask,
  type RecommendInput,
} from './recommend'

const now = new Date('2026-09-28T15:00:00Z')

function daysAgo(days: number, hours = 0): string {
  return new Date(
    now.getTime() - days * 24 * 3600 * 1000 - hours * 3600 * 1000,
  ).toISOString()
}

function dateIn(days: number): string {
  return new Date(now.getTime() + days * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10)
}

function task(id: string, overrides: Partial<EngineTask> = {}): EngineTask {
  return {
    id,
    project_id: null,
    title: id,
    estimated_minutes: 20,
    energy: 'medium',
    importance: 2,
    due_date: null,
    smaller_version: null,
    status: 'open',
    deferred_until: null,
    created_at: daysAgo(1),
    ...overrides,
  }
}

function project(
  id: string,
  overrides: Partial<EngineProject> = {},
): EngineProject {
  return {
    id,
    name: id,
    status: 'active',
    created_at: daysAgo(1),
    ...overrides,
  }
}

function event(
  taskId: string,
  kind: EngineEvent['kind'],
  createdAt: string,
  projectId: string | null = null,
): EngineEvent {
  return { task_id: taskId, project_id: projectId, kind, created_at: createdAt }
}

function input(
  tasks: EngineTask[],
  options: {
    projects?: EngineProject[]
    events?: EngineEvent[]
    checkIn?: CheckIn
  } = {},
): RecommendInput {
  return {
    tasks,
    projects: options.projects ?? [],
    events: options.events ?? [],
    checkIn: options.checkIn ?? { minutes: 25, energy: 'medium' },
    now,
  }
}

function pick(i: RecommendInput) {
  return recommend(i)?.task.id ?? null
}

describe('recommend', () => {
  it('returns null when nothing fits', () => {
    expect(recommend(input([]))).toBeNull()
    expect(pick(input([task('long', { estimated_minutes: 90 })]))).toBeNull()
  })

  it('excludes tasks longer than the time available', () => {
    const tasks = [
      task('important but long', { estimated_minutes: 45, importance: 3 }),
      task('fits', { estimated_minutes: 20, importance: 1 }),
    ]
    expect(
      pick(input(tasks, { checkIn: { minutes: 25, energy: 'high' } })),
    ).toBe('fits')
  })

  it('offers a too-big task through its smaller version', () => {
    const rec = recommend(
      input(
        [
          task('big', {
            estimated_minutes: 90,
            importance: 3,
            smaller_version: 'Outline it',
          }),
        ],
        { checkIn: { minutes: 10, energy: 'medium' } },
      ),
    )
    expect(rec?.task.id).toBe('big')
    expect(rec?.useSmallerVersion).toBe(true)
  })

  it('prefers a full task over an equal one offered only as a smaller version', () => {
    const tasks = [
      task('big', { estimated_minutes: 90, smaller_version: 'Outline it' }),
      task('small', { estimated_minutes: 20 }),
    ]
    expect(pick(input(tasks))).toBe('small')
  })

  it('never recommends a high-energy task on low energy', () => {
    const tasks = [
      task('deep work', { energy: 'high', importance: 3, due_date: dateIn(0) }),
      task('easy', { energy: 'low', importance: 1 }),
    ]
    expect(
      pick(input(tasks, { checkIn: { minutes: 60, energy: 'low' } })),
    ).toBe('easy')
  })

  it('uses high energy for a matching task when importance is equal', () => {
    const tasks = [
      task('easy', { energy: 'low' }),
      task('hard', { energy: 'high' }),
    ]
    expect(
      pick(input(tasks, { checkIn: { minutes: 25, energy: 'high' } })),
    ).toBe('hard')
  })

  it('prefers more important tasks', () => {
    const tasks = [
      task('nice', { importance: 1 }),
      task('essential', { importance: 3 }),
      task('important', { importance: 2 }),
    ]
    expect(pick(input(tasks))).toBe('essential')
  })

  it('lets a deadline beat project neglect', () => {
    const projects = [project('neglected', { created_at: daysAgo(30) })]
    const tasks = [
      task('neglected step', { project_id: 'neglected' }),
      task('due tomorrow', { due_date: dateIn(1) }),
    ]
    expect(pick(input(tasks, { projects }))).toBe('due tomorrow')
  })

  it('treats overdue tasks as the most urgent', () => {
    const tasks = [
      task('due next week', { due_date: dateIn(7) }),
      task('overdue', { due_date: dateIn(-2) }),
    ]
    const rec = recommend(input(tasks))
    expect(rec?.task.id).toBe('overdue')
    expect(rec?.factors.find((f) => f.key === 'deadline')?.score).toBe(1)
  })

  it('boosts projects that have gone longest without progress', () => {
    const projects = [project('fresh'), project('stale')]
    const events = [
      event('old-a', 'completed', daysAgo(0, 2), 'fresh'),
      event('old-b', 'completed', daysAgo(9), 'stale'),
    ]
    const tasks = [
      task('fresh step', { project_id: 'fresh' }),
      task('stale step', { project_id: 'stale' }),
    ]
    const rec = recommend(input(tasks, { projects, events }))
    expect(rec?.task.id).toBe('stale step')
    expect(rec?.factors.find((f) => f.key === 'neglect')).toMatchObject({
      projectName: 'stale',
      daysSinceProgress: 9,
    })
  })

  it('does not repeat a task you just skipped', () => {
    const tasks = [
      task('skipped', { importance: 3 }),
      task('other', { importance: 1 }),
    ]
    const events = [event('skipped', 'skipped', daysAgo(0, 1))]
    expect(pick(input(tasks, { events }))).toBe('other')
  })

  it('gently brings back tasks that were postponed a while ago', () => {
    const tasks = [task('lingering'), task('new')]
    const events = [
      event('lingering', 'deferred', daysAgo(3)),
      event('lingering', 'skipped', daysAgo(2)),
    ]
    const rec = recommend(input(tasks, { events }))
    expect(rec?.task.id).toBe('lingering')
    expect(rec?.factors.find((f) => f.key === 'postponed')).toMatchObject({
      times: 2,
    })
  })

  it('ignores deferred, done, and resting-project tasks', () => {
    const projects = [project('paused', { status: 'paused' })]
    const tasks = [
      task('deferred', { importance: 3, deferred_until: dateIn(1) }),
      task('done', { importance: 3, status: 'done' }),
      task('paused project', { importance: 3, project_id: 'paused' }),
      task('available', { importance: 1 }),
    ]
    expect(pick(input(tasks, { projects }))).toBe('available')
  })

  it('breaks ties by picking the task that has waited longest', () => {
    const tasks = [
      task('b-newer', { created_at: daysAgo(1) }),
      task('a-older', { created_at: daysAgo(5) }),
    ]
    expect(pick(input(tasks))).toBe('a-older')
    // Same input, same answer.
    expect(pick(input([...tasks].reverse()))).toBe('a-older')
  })

  it('explains the score: contributions add up and are sorted', () => {
    const rec = recommend(
      input([task('t', { importance: 3, due_date: dateIn(0) })]),
    )!
    const sum = rec.factors.reduce((s, f) => s + f.contribution, 0)
    expect(rec.score).toBeCloseTo(sum)
    const contributions = rec.factors.map((f) => f.contribution)
    expect(contributions).toEqual([...contributions].sort((a, b) => b - a))
    expect(rec.factors[0]).toMatchObject({ key: 'deadline', daysUntilDue: 0 })
  })

  it('takes weights from the config', () => {
    const tasks = [
      task('important', { importance: 3 }),
      task('due soon', { importance: 1, due_date: dateIn(1) }),
    ]
    expect(pick(input(tasks))).toBe('due soon')

    const importanceFirst = {
      ...DEFAULT_CONFIG,
      weights: { ...DEFAULT_CONFIG.weights, importance: 10 },
    }
    expect(recommend(input(tasks), importanceFirst)?.task.id).toBe('important')
  })
})

describe('rankTasks', () => {
  it('ranks every fitting task, best first', () => {
    const tasks = [
      task('nice', { importance: 1 }),
      task('essential', { importance: 3 }),
      task('too long', { estimated_minutes: 60 }),
    ]
    expect(rankTasks(input(tasks)).map((r) => r.task.id)).toEqual([
      'essential',
      'nice',
    ])
  })
})
