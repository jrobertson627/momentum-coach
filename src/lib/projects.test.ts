import { describe, expect, it } from 'vitest'
import { groupProjects, statusChange, type Project } from './projects'

function project(overrides: Partial<Project>): Project {
  return {
    id: crypto.randomUUID(),
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

describe('groupProjects', () => {
  it('buckets projects by status, keeping their order', () => {
    const a = project({ name: 'A' })
    const b = project({ name: 'B', status: 'paused' })
    const c = project({ name: 'C' })
    const d = project({ name: 'D', status: 'archived' })

    const groups = groupProjects([a, b, c, d])

    expect(groups.active).toEqual([a, c])
    expect(groups.paused).toEqual([b])
    expect(groups.finished).toEqual([])
    expect(groups.archived).toEqual([d])
  })
})

describe('statusChange', () => {
  it('stamps finished_at when finishing', () => {
    const changes = statusChange('finished')
    expect(changes.status).toBe('finished')
    expect(Date.parse(changes.finished_at!)).not.toBeNaN()
  })

  it('clears finished_at for any other status', () => {
    expect(statusChange('active')).toEqual({
      status: 'active',
      finished_at: null,
    })
  })
})
