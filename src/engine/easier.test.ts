import { describe, expect, it } from 'vitest'
import {
  easierAlternative,
  recommend,
  type CheckIn,
  type EngineTask,
  type RecommendInput,
} from './recommend'

const now = new Date('2026-09-28T15:00:00Z')

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
    created_at: '2026-09-27T00:00:00Z',
    ...overrides,
  }
}

function input(
  tasks: EngineTask[],
  checkIn: CheckIn = { minutes: 45, energy: 'high' },
): RecommendInput {
  return { tasks, projects: [], events: [], checkIn, now }
}

describe('easierAlternative', () => {
  it('offers the current task’s smaller version first', () => {
    const i = input([
      task('report', {
        energy: 'high',
        importance: 3,
        smaller_version: 'Write three bullet points',
      }),
      task('email', { energy: 'low' }),
    ])
    const current = recommend(i)!
    expect(current.task.id).toBe('report')

    const easier = easierAlternative(i, current)!
    expect(easier.recommendation.task.id).toBe('report')
    expect(easier.recommendation.useSmallerVersion).toBe(true)
    // The check-in is unchanged: only the task got smaller.
    expect(easier.checkIn).toEqual(i.checkIn)
  })

  it('otherwise re-runs the engine one energy level lower', () => {
    const i = input([
      task('deep work', { energy: 'high', importance: 3 }),
      task('medium task', { energy: 'medium', importance: 2 }),
      task('easy task', { energy: 'low', importance: 1 }),
    ])
    const current = recommend(i)!
    expect(current.task.id).toBe('deep work')

    const easier = easierAlternative(i, current)!
    expect(easier.checkIn.energy).toBe('medium')
    expect(easier.recommendation.task.id).toBe('medium task')
  })

  it('can be pressed again to go easier still', () => {
    const tasks = [
      task('deep work', { energy: 'high', importance: 3 }),
      task('medium task', { energy: 'medium', importance: 2 }),
      task('easy task', { energy: 'low', importance: 1 }),
    ]
    const i = input(tasks)
    const first = easierAlternative(i, recommend(i)!)!
    const second = easierAlternative(
      { ...i, checkIn: first.checkIn },
      first.recommendation,
      new Set(['deep work', 'medium task']),
    )!
    expect(second.checkIn.energy).toBe('low')
    expect(second.recommendation.task.id).toBe('easy task')
  })

  it('never offers something that asks more', () => {
    const i = input(
      [
        task('short easy', {
          energy: 'low',
          estimated_minutes: 10,
          importance: 3,
        }),
        task('long easy', {
          energy: 'low',
          estimated_minutes: 40,
          importance: 1,
        }),
      ],
      { minutes: 45, energy: 'low' },
    )
    const current = recommend(i)!
    expect(current.task.id).toBe('short easy')
    // Already low energy and the other task is longer: nothing lighter.
    expect(easierAlternative(i, current)).toBeNull()
  })

  it('at low energy, offers a shorter task instead', () => {
    const i = input(
      [
        task('long easy', {
          energy: 'low',
          estimated_minutes: 40,
          importance: 3,
        }),
        task('quick easy', {
          energy: 'low',
          estimated_minutes: 5,
          importance: 1,
        }),
      ],
      { minutes: 45, energy: 'low' },
    )
    const easier = easierAlternative(i, recommend(i)!)!
    expect(easier.recommendation.task.id).toBe('quick easy')
  })

  it('skips tasks already shown', () => {
    const i = input([
      task('deep work', { energy: 'high', importance: 3 }),
      task('shown', { energy: 'medium', importance: 3 }),
      task('fresh', { energy: 'medium', importance: 1 }),
    ])
    const easier = easierAlternative(i, recommend(i)!, new Set(['shown']))!
    expect(easier.recommendation.task.id).toBe('fresh')
  })

  it('after a smaller version, only offers tiny low-energy steps', () => {
    const i = input([
      task('report', {
        energy: 'high',
        importance: 3,
        smaller_version: 'Outline it',
      }),
      task('medium 20', { energy: 'medium', estimated_minutes: 20 }),
      task('low 5', { energy: 'low', estimated_minutes: 5, importance: 1 }),
    ])
    const smaller = easierAlternative(i, recommend(i)!)!
    const next = easierAlternative(
      { ...i, checkIn: smaller.checkIn },
      smaller.recommendation,
    )!
    expect(next.recommendation.task.id).toBe('low 5')
  })

  it('returns null when nothing is lighter', () => {
    const i = input([task('only', { energy: 'low', estimated_minutes: 5 })], {
      minutes: 10,
      energy: 'low',
    })
    expect(easierAlternative(i, recommend(i)!)).toBeNull()
  })
})
