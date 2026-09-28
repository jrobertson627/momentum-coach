import { describe, expect, it } from 'vitest'
import { createTestDb } from './db.ts'

describe('realtime sync', () => {
  it('publishes every app table so devices stay in sync', async () => {
    const db = await createTestDb()
    const { rows } = await db.query<{ tablename: string }>(
      `select tablename from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public'
       order by tablename`,
    )
    expect(rows.map((r) => r.tablename)).toEqual([
      'ideas',
      'projects',
      'reward_ledger',
      'task_events',
      'tasks',
    ])
  })
})
