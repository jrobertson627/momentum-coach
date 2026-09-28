import { describe, expect, it } from 'vitest'
import { explain, reasonFor, topReasons } from './explain'
import {
  recommend,
  type EngineProject,
  type EngineTask,
  type Factor,
  type Recommendation,
} from './recommend'

const now = new Date('2026-09-28T15:00:00Z')

function task(overrides: Partial<EngineTask> = {}): EngineTask {
  return {
    id: 't',
    project_id: null,
    title: 'Task',
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

function recommendation(
  factors: (Factor & { contribution: number })[],
  useSmallerVersion = false,
): Recommendation {
  return {
    task: task(),
    useSmallerVersion,
    score: factors.reduce((s, f) => s + f.contribution, 0),
    factors: factors.map((f) => ({ ...f, weight: 1 })),
  }
}

describe('explain', () => {
  it('reads like the example in the issue', () => {
    const tracker: EngineProject = {
      id: 'tracker',
      name: 'Workout tracker',
      status: 'active',
      created_at: '2026-09-22T12:00:00Z',
    }
    const rec = recommend({
      tasks: [
        task({ project_id: 'tracker', estimated_minutes: 25, importance: 1 }),
      ],
      projects: [tracker],
      events: [],
      checkIn: { minutes: 25, energy: 'medium' },
      now,
    })!

    expect(explain(rec)).toBe(
      'Recommended because it moves Workout tracker forward after 6 quiet days, fits your 25 minutes, and matches your energy.',
    )
  })

  it('uses at most three reasons, most influential first', () => {
    const rec = recommendation([
      {
        key: 'fitsTime',
        score: 1,
        minutes: 25,
        available: 25,
        contribution: 1,
      },
      { key: 'deadline', score: 1, daysUntilDue: 0, contribution: 3 },
      { key: 'importance', score: 1, importance: 3, contribution: 2 },
      {
        key: 'energyMatch',
        score: 1,
        task: 'low',
        available: 'low',
        contribution: 0.9,
      },
    ])
    expect(topReasons(rec)).toEqual([
      'is due today',
      'is essential',
      'fits your 25 minutes',
    ])
  })

  it('joins two reasons without a comma', () => {
    const rec = recommendation([
      { key: 'deadline', score: 1, daysUntilDue: 1, contribution: 3 },
      { key: 'importance', score: 1, importance: 3, contribution: 2 },
    ])
    expect(explain(rec)).toBe(
      'Recommended because it is due tomorrow and is essential.',
    )
  })

  it('skips factors that barely mattered or pushed the score down', () => {
    const rec = recommendation([
      { key: 'importance', score: 0, importance: 1, contribution: 0 },
      { key: 'deadline', score: 0.1, daysUntilDue: 13, contribution: 0.2 },
      { key: 'recentlySkipped', score: 1, contribution: -6 },
      {
        key: 'fitsTime',
        score: 0.8,
        minutes: 15,
        available: 25,
        contribution: 0.8,
      },
    ])
    expect(explain(rec)).toBe('Recommended because it fits your 25 minutes.')
  })

  it('still says something when no reason stands out', () => {
    expect(explain(recommendation([]))).toBe('It fits what you have right now.')
  })

  it('frames a smaller version as an easy start', () => {
    const rec = recommendation(
      [
        { key: 'importance', score: 1, importance: 3, contribution: 2 },
        {
          key: 'energyMatch',
          score: 0.6,
          task: 'high',
          available: 'low',
          contribution: 0.6,
        },
        {
          key: 'fitsTime',
          score: 0.5,
          minutes: 90,
          available: 10,
          contribution: 0.5,
        },
      ],
      true,
    )
    expect(explain(rec)).toBe(
      'Recommended because it is essential, is gentle on your energy, and is a small step you can start right away.',
    )
  })
})

describe('reasonFor: calm wording', () => {
  const calmCases: Factor[] = [
    { key: 'deadline', score: 1, daysUntilDue: -5 },
    { key: 'deadline', score: 1, daysUntilDue: 0 },
    { key: 'deadline', score: 0.5, daysUntilDue: 7 },
    { key: 'neglect', score: 1, projectName: 'Garden', daysSinceProgress: 30 },
    { key: 'neglect', score: 0, projectName: 'Garden', daysSinceProgress: 1 },
    { key: 'postponed', score: 1, times: 9 },
    { key: 'energyMatch', score: 0.5, task: 'low', available: 'high' },
    { key: 'fitsTime', score: 1, minutes: 60, available: 120 },
  ]
  const guilt =
    /overdue|late|behind|fail|miss|streak|should|must|finally|again|!|still|neglect|ignored|\d+ times/i

  it.each(calmCases)('$key never shames', (factor) => {
    const reason = reasonFor(factor)
    expect(reason).not.toBeNull()
    expect(reason).not.toMatch(guilt)
  })

  it('handles singular and plural days', () => {
    expect(
      reasonFor({
        key: 'neglect',
        score: 1,
        projectName: 'Garden',
        daysSinceProgress: 2,
      }),
    ).toBe('moves Garden forward after 2 quiet days')
    expect(reasonFor({ key: 'deadline', score: 1, daysUntilDue: 3 })).toBe(
      'is due in 3 days',
    )
  })

  it('says "the time you have" for 60+ minutes', () => {
    expect(
      reasonFor({ key: 'fitsTime', score: 1, minutes: 60, available: 120 }),
    ).toBe('fits the time you have')
  })
})
