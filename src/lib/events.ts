import type { EngineEvent } from '../engine/recommend'
import { supabase } from './supabase'

/** How much history the engine looks at. */
export const EVENT_HISTORY_DAYS = 30

/** Recent task events, with each task's project for progress tracking. */
export async function fetchRecentEvents(
  days = EVENT_HISTORY_DAYS,
): Promise<EngineEvent[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const { data, error } = await supabase
    .from('task_events')
    .select('task_id, kind, created_at, tasks(project_id)')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data.map((row) => ({
    task_id: row.task_id,
    kind: row.kind,
    created_at: row.created_at,
    project_id: row.tasks?.project_id ?? null,
  }))
}
