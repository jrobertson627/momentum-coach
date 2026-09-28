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
