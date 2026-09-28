import type { CheckIn } from './checkIn'
import { supabase } from './supabase'
import type { Task } from './tasks'

export type TaskAction =
  | { kind: 'completed' }
  /** Finished the task's smaller version: progress, the task stays open. */
  | { kind: 'progressed' }
  | { kind: 'skipped' }
  | { kind: 'deferred'; until: Date }

/**
 * Completes, skips or defers a task and logs it with the check-in, in one
 * database transaction (see the act_on_task migration).
 */
export async function actOnTask(
  taskId: string,
  action: TaskAction,
  checkIn: CheckIn,
): Promise<Task> {
  const { data, error } = await supabase.rpc('act_on_task', {
    p_task_id: taskId,
    p_kind: action.kind,
    p_available_minutes: checkIn.minutes,
    p_energy: checkIn.energy,
    p_deferred_until:
      action.kind === 'deferred' ? action.until.toISOString() : undefined,
  })
  if (error) throw new Error(error.message)
  return data
}

/** Local midnight at the start of the day `days` from `now`. */
export function startOfDayIn(days: number, now: Date = new Date()): Date {
  const date = new Date(now)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return date
}

/** Local midnight at the start of a `YYYY-MM-DD` date. */
export function startOfDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}
