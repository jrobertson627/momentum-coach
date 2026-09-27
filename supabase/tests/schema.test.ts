import { beforeEach, describe, expect, it } from 'vitest'
import { actAs, createTestDb, createUser, type TestDb } from './db.ts'

let db: TestDb
let alice: string
let bob: string

beforeEach(async () => {
  db = await createTestDb()
  alice = await createUser(db)
  bob = await createUser(db)
})

async function insertProject(name: string, status = 'active') {
  const { rows } = await db.query<{ id: string }>(
    'insert into public.projects (name, status) values ($1, $2) returning id',
    [name, status],
  )
  return rows[0].id
}

async function insertTask(title: string, projectId: string | null = null) {
  const { rows } = await db.query<{ id: string }>(
    'insert into public.tasks (title, project_id) values ($1, $2) returning id',
    [title, projectId],
  )
  return rows[0].id
}

async function count(table: string) {
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int as n from public.${table}`,
  )
  return rows[0].n
}

describe('row-level security', () => {
  it('users only see their own rows in every table', async () => {
    await actAs(db, alice)
    const project = await insertProject('Workout tracker')
    const task = await insertTask('Make the basic chart work', project)
    await db.query('insert into public.ideas (text) values ($1)', ['Pixel art'])
    await db.query(
      `insert into public.task_events (task_id, kind) values ($1, 'completed')`,
      [task],
    )
    await db.query(
      `insert into public.reward_ledger (minutes, reason, task_id) values (10, 'task_completed', $1)`,
      [task],
    )

    await actAs(db, bob)
    for (const table of [
      'projects',
      'tasks',
      'ideas',
      'task_events',
      'reward_ledger',
      'reward_balances',
    ]) {
      expect(await count(table), table).toBe(0)
    }

    await actAs(db, alice)
    expect(await count('projects')).toBe(1)
    expect(await count('reward_balances')).toBe(1)
  })

  it('signed-out (anon) requests are refused', async () => {
    await actAs(db, null)
    await expect(count('projects')).rejects.toThrow(/permission denied/)
  })

  it('user_id defaults to the signed-in user and cannot be spoofed', async () => {
    await actAs(db, alice)
    await insertProject('Mine')
    const { rows } = await db.query<{ user_id: string }>(
      'select user_id from public.projects',
    )
    expect(rows[0].user_id).toBe(alice)

    await expect(
      db.query('insert into public.projects (name, user_id) values ($1, $2)', [
        'Sneaky',
        bob,
      ]),
    ).rejects.toThrow(/row-level security/)
  })

  it("users cannot update or delete other users' rows", async () => {
    await actAs(db, alice)
    await insertProject('Alice project')

    await actAs(db, bob)
    const updated = await db.query(`update public.projects set name = 'Hacked'`)
    const deleted = await db.query('delete from public.projects')
    expect(updated.affectedRows).toBe(0)
    expect(deleted.affectedRows).toBe(0)
  })

  it("users cannot attach rows to another user's project or task", async () => {
    await actAs(db, alice)
    const project = await insertProject('Alice project')
    const task = await insertTask('Alice task', project)

    await actAs(db, bob)
    await expect(insertTask('Bob task', project)).rejects.toThrow(
      /row-level security/,
    )
    await expect(
      db.query(
        `insert into public.task_events (task_id, kind) values ($1, 'completed')`,
        [task],
      ),
    ).rejects.toThrow(/row-level security/)
    await expect(
      db.query(
        `insert into public.reward_ledger (minutes, reason, task_id) values (60, 'task_completed', $1)`,
        [task],
      ),
    ).rejects.toThrow(/row-level security/)
    await expect(
      db.query(
        'insert into public.ideas (text, promoted_project_id) values ($1, $2)',
        ['Idea', project],
      ),
    ).rejects.toThrow(/row-level security/)
  })

  it('history tables are append-only', async () => {
    await actAs(db, alice)
    const task = await insertTask('Laundry')
    await db.query(
      `insert into public.task_events (task_id, kind) values ($1, 'skipped')`,
      [task],
    )
    await db.query(
      `insert into public.reward_ledger (minutes, reason) values (5, 'adjustment')`,
    )

    await expect(
      db.query(`update public.task_events set kind = 'completed'`),
    ).rejects.toThrow(/permission denied/)
    await expect(db.query('delete from public.reward_ledger')).rejects.toThrow(
      /permission denied/,
    )
  })

  it('app users cannot truncate tables', async () => {
    await actAs(db, alice)
    await expect(db.query('truncate public.projects')).rejects.toThrow(
      /permission denied/,
    )
  })
})

describe('active project limit', () => {
  it('allows 3 active projects and rejects a 4th', async () => {
    await actAs(db, alice)
    await insertProject('One')
    await insertProject('Two')
    await insertProject('Three')
    await expect(insertProject('Four')).rejects.toThrow(
      /already have 3 active projects/,
    )
    // Paused projects don't count toward the limit.
    await insertProject('Four', 'paused')
  })

  it('rejects re-activating a paused project while 3 are active', async () => {
    await actAs(db, alice)
    const one = await insertProject('One')
    await insertProject('Two')
    await insertProject('Three')
    const paused = await insertProject('Paused', 'paused')

    await expect(
      db.query(`update public.projects set status = 'active' where id = $1`, [
        paused,
      ]),
    ).rejects.toThrow(/already have 3 active projects/)

    await db.query(
      `update public.projects set status = 'finished' where id = $1`,
      [one],
    )
    await db.query(
      `update public.projects set status = 'active' where id = $1`,
      [paused],
    )
    // Editing an already-active project is not an activation.
    await db.query(
      `update public.projects set name = 'Renamed' where id = $1`,
      [paused],
    )
  })

  it('counts each user separately', async () => {
    await actAs(db, alice)
    await insertProject('A1')
    await insertProject('A2')
    await insertProject('A3')

    await actAs(db, bob)
    await insertProject('B1')
    expect(await count('projects')).toBe(1)
  })
})

describe('reward credits', () => {
  it('tracks a balance and never goes negative', async () => {
    await actAs(db, alice)
    await db.query(
      `insert into public.reward_ledger (minutes, reason) values (30, 'task_completed')`,
    )
    await db.query(
      `insert into public.reward_ledger (minutes, reason) values (-20, 'game_time')`,
    )
    await expect(
      db.query(
        `insert into public.reward_ledger (minutes, reason) values (-11, 'game_time')`,
      ),
    ).rejects.toThrow(/Not enough game-time credits/)

    const { rows } = await db.query<{ minutes: number }>(
      'select minutes from public.reward_balances',
    )
    expect(rows[0].minutes).toBe(10)
  })
})

describe('tasks', () => {
  it('applies sensible defaults and validates input', async () => {
    await actAs(db, alice)
    await insertTask('Standalone chore')
    const { rows } = await db.query<{
      estimated_minutes: number
      energy: string
      importance: number
      status: string
    }>('select estimated_minutes, energy, importance, status from public.tasks')
    expect(rows[0]).toEqual({
      estimated_minutes: 25,
      energy: 'medium',
      importance: 2,
      status: 'open',
    })

    await expect(
      db.query('insert into public.tasks (title, importance) values ($1, 5)', [
        'Too important',
      ]),
    ).rejects.toThrow(/check constraint/)
    await expect(insertTask('   ')).rejects.toThrow(/check constraint/)
  })

  it('updated_at changes on update', async () => {
    await actAs(db, alice)
    const id = await insertTask('Dishes')
    const before = await db.query<{ updated_at: Date }>(
      'select updated_at from public.tasks where id = $1',
      [id],
    )
    await new Promise((r) => setTimeout(r, 5))
    await db.query(
      `update public.tasks set title = 'Wash dishes' where id = $1`,
      [id],
    )
    const after = await db.query<{ updated_at: Date }>(
      'select updated_at from public.tasks where id = $1',
      [id],
    )
    expect(after.rows[0].updated_at.getTime()).toBeGreaterThan(
      before.rows[0].updated_at.getTime(),
    )
  })
})
