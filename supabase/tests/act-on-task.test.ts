import { beforeEach, describe, expect, it } from 'vitest'
import { creditsFor, SMALLER_STEP_MINUTES } from '../../src/lib/rewards.ts'
import { actAs, createTestDb, createUser, type TestDb } from './db.ts'

let db: TestDb
let alice: string
let bob: string

beforeEach(async () => {
  db = await createTestDb()
  alice = await createUser(db)
  bob = await createUser(db)
})

async function newTask(title = 'Laundry') {
  const { rows } = await db.query<{ id: string }>(
    'insert into public.tasks (title) values ($1) returning id',
    [title],
  )
  return rows[0].id
}

type TaskRow = {
  status: string
  completed_at: Date | null
  deferred_until: Date | null
}

async function act(
  taskId: string,
  kind: string,
  deferredUntil: string | null = null,
) {
  const { rows } = await db.query<TaskRow>(
    `select status, completed_at, deferred_until
       from public.act_on_task($1, $2::public.task_event_kind, 25, 'low', $3)`,
    [taskId, kind, deferredUntil],
  )
  return rows[0]
}

async function events() {
  const { rows } = await db.query<{
    kind: string
    available_minutes: number
    energy: string
  }>(
    'select kind, available_minutes, energy from public.task_events order by created_at',
  )
  return rows
}

describe('act_on_task', () => {
  it('completes a task and logs the check-in with it', async () => {
    await actAs(db, alice)
    const id = await newTask()

    const task = await act(id, 'completed')

    expect(task.status).toBe('done')
    expect(task.completed_at).toBeInstanceOf(Date)
    expect(await events()).toEqual([
      { kind: 'completed', available_minutes: 25, energy: 'low' },
    ])
  })

  it('logs a skip without changing the task', async () => {
    await actAs(db, alice)
    const id = await newTask()

    const task = await act(id, 'skipped')

    expect(task.status).toBe('open')
    expect((await events()).map((e) => e.kind)).toEqual(['skipped'])
  })

  it('defers a task until a future time', async () => {
    await actAs(db, alice)
    const id = await newTask()
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString()

    const task = await act(id, 'deferred', tomorrow)

    expect(task.deferred_until?.toISOString()).toBe(tomorrow)
    expect((await events()).map((e) => e.kind)).toEqual(['deferred'])
  })

  it('rejects deferring into the past, and logs nothing', async () => {
    await actAs(db, alice)
    const id = await newTask()

    await expect(act(id, 'deferred', '2020-01-01T00:00:00Z')).rejects.toThrow(
      /time in the future/,
    )
    await expect(act(id, 'deferred', null)).rejects.toThrow(
      /time in the future/,
    )
    expect(await events()).toEqual([])
  })

  it("can't act on another user's task", async () => {
    await actAs(db, alice)
    const id = await newTask()

    await actAs(db, bob)
    await expect(act(id, 'completed')).rejects.toThrow(/Task not found/)
    await expect(act(id, 'skipped')).rejects.toThrow(/Task not found/)

    await actAs(db, alice)
    expect(await events()).toEqual([])
    const { rows } = await db.query<{ status: string }>(
      'select status from public.tasks',
    )
    expect(rows[0].status).toBe('open')
  })

  it("can't complete a task twice", async () => {
    await actAs(db, alice)
    const id = await newTask()
    await act(id, 'completed')

    await expect(act(id, 'completed')).rejects.toThrow(/Task not found/)
    expect(await events()).toHaveLength(1)
  })

  it('completing clears a deferral', async () => {
    await actAs(db, alice)
    const id = await newTask()
    await act(id, 'deferred', new Date(Date.now() + 3600 * 1000).toISOString())

    const task = await act(id, 'completed')
    expect(task.deferred_until).toBeNull()
  })

  it('is not callable when signed out', async () => {
    await actAs(db, alice)
    const id = await newTask()

    await actAs(db, null)
    await expect(act(id, 'completed')).rejects.toThrow(/permission denied/)
  })
})

describe('rewards and first steps', () => {
  async function newSizedTask(estimatedMinutes: number, smaller?: string) {
    const { rows } = await db.query<{ id: string }>(
      `insert into public.tasks (title, estimated_minutes, smaller_version)
       values ('Write report', $1, $2) returning id`,
      [estimatedMinutes, smaller ?? null],
    )
    return rows[0].id
  }

  async function balance() {
    const { rows } = await db.query<{ minutes: number }>(
      'select minutes from public.reward_balances',
    )
    return rows[0]?.minutes ?? 0
  }

  it('completing a task earns credits, matching the app’s formula', async () => {
    await actAs(db, alice)
    await act(await newSizedTask(25), 'completed')
    await act(await newSizedTask(1), 'completed')

    expect(await balance()).toBe(creditsFor(25) + creditsFor(1))
    expect(creditsFor(25)).toBe(13)
    expect(creditsFor(1)).toBe(1)
  })

  it('skipping and deferring earn nothing', async () => {
    await actAs(db, alice)
    const id = await newSizedTask(60)
    await act(id, 'skipped')
    await act(id, 'deferred', new Date(Date.now() + 3600 * 1000).toISOString())

    expect(await balance()).toBe(0)
  })

  it('finishing a first step keeps the task open and clears the step', async () => {
    await actAs(db, alice)
    const id = await newSizedTask(90, 'Outline it')

    const task = await act(id, 'progressed')

    expect(task.status).toBe('open')
    const { rows } = await db.query<{ smaller_version: string | null }>(
      'select smaller_version from public.tasks where id = $1',
      [id],
    )
    expect(rows[0].smaller_version).toBeNull()
    expect((await events()).map((e) => e.kind)).toEqual(['progressed'])
    expect(await balance()).toBe(creditsFor(SMALLER_STEP_MINUTES))
  })

  it('spending game time reduces the balance but never below zero', async () => {
    await actAs(db, alice)
    await act(await newSizedTask(40), 'completed') // earns 20

    await db.query(
      `insert into public.reward_ledger (minutes, reason, note)
       values (-15, 'game_time', 'Stardew Valley')`,
    )
    expect(await balance()).toBe(5)

    await expect(
      db.query(
        `insert into public.reward_ledger (minutes, reason) values (-6, 'game_time')`,
      ),
    ).rejects.toThrow(/Not enough game-time credits/)
    expect(await balance()).toBe(5)
  })

  it('credits are per user', async () => {
    await actAs(db, alice)
    await act(await newSizedTask(40), 'completed')

    await actAs(db, bob)
    expect(await balance()).toBe(0)
    await expect(
      db.query(
        `insert into public.reward_ledger (minutes, reason) values (-1, 'game_time')`,
      ),
    ).rejects.toThrow(/Not enough game-time credits/)
  })
})

describe('repeating tasks', () => {
  async function newRepeating(repeat: object | null) {
    const { rows } = await db.query<{ id: string }>(
      `insert into public.tasks (title, estimated_minutes, repeat)
       values ('Tidy desk', 10, $1) returning id`,
      [repeat === null ? null : JSON.stringify(repeat)],
    )
    return rows[0].id
  }

  async function complete(id: string, next: string | null) {
    const { rows } = await db.query<TaskRow>(
      `select status, completed_at, deferred_until
         from public.act_on_task($1, 'completed', 25, 'low', null, $2)`,
      [id, next],
    )
    return rows[0]
  }

  it('accepts every valid pattern', async () => {
    await actAs(db, alice)
    for (const repeat of [
      { kind: 'daily' },
      { kind: 'weekdays', days: [1, 3, 5] },
      { kind: 'interval', every: 2, unit: 'week' },
      { kind: 'monthly', day: 31 },
    ]) {
      await newRepeating(repeat)
    }
  })

  it('rejects malformed patterns', async () => {
    await actAs(db, alice)
    for (const repeat of [
      { kind: 'yearly' },
      { kind: 'weekdays', days: [] },
      { kind: 'weekdays', days: [7] },
      { kind: 'weekdays', days: ['1'] },
      { kind: 'interval', every: 0, unit: 'day' },
      { kind: 'interval', every: 2, unit: 'month' },
      { kind: 'monthly', day: 32 },
      [1, 2],
    ]) {
      await expect(newRepeating(repeat)).rejects.toThrow(/tasks_repeat_valid/)
    }
  })

  it('completing brings it back on its next date instead of finishing it', async () => {
    await actAs(db, alice)
    const id = await newRepeating({ kind: 'daily' })
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString()

    const task = await complete(id, tomorrow)

    expect(task.status).toBe('open')
    expect(task.completed_at).toBeInstanceOf(Date)
    expect(task.deferred_until?.toISOString()).toBe(tomorrow)
    expect((await events()).map((e) => e.kind)).toEqual(['completed'])
    const { rows } = await db.query<{ minutes: number }>(
      'select minutes from public.reward_balances',
    )
    expect(rows[0].minutes).toBe(creditsFor(10))
  })

  it('needs a next date in the future', async () => {
    await actAs(db, alice)
    const id = await newRepeating({ kind: 'daily' })

    await expect(complete(id, null)).rejects.toThrow(/needs its next date/)
    await expect(complete(id, '2020-01-01T00:00:00Z')).rejects.toThrow(
      /needs its next date/,
    )
    expect(await events()).toEqual([])
  })

  it('one-off tasks still finish, ignoring any next date', async () => {
    await actAs(db, alice)
    const id = await newRepeating(null)
    const task = await complete(
      id,
      new Date(Date.now() + 3600 * 1000).toISOString(),
    )
    expect(task.status).toBe('done')
  })
})
