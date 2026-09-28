import type {
  Enums,
  Tables,
  TablesInsert,
  TablesUpdate,
} from './database.types'
import type { Project } from './projects'
import { supabase } from './supabase'

export type Task = Tables<'tasks'>
export type Energy = Enums<'energy_level'>
export type TaskFields = Pick<
  TablesInsert<'tasks'>,
  | 'title'
  | 'project_id'
  | 'estimated_minutes'
  | 'energy'
  | 'importance'
  | 'due_date'
  | 'smaller_version'
>
export type TaskChanges = Pick<TablesUpdate<'tasks'>, keyof TaskFields>

export const ENERGY_LABELS: Record<Energy, string> = {
  low: 'Low energy',
  medium: 'Medium energy',
  high: 'High energy',
}

export const IMPORTANCE_LABELS: Record<number, string> = {
  1: 'Nice to have',
  2: 'Important',
  3: 'Essential',
}

/** Open tasks, oldest first so long-waiting ones stay visible. */
export async function fetchOpenTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return data
}

export async function createTask(task: TaskFields): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert(task)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

/** Creates several tasks in one request (one database round trip). */
export async function createTasks(tasks: TaskFields[]): Promise<Task[]> {
  const { data, error } = await supabase.from('tasks').insert(tasks).select()
  if (error) throw new Error(error.message)
  return data
}

/** Task titles are limited to this many characters in the database. */
export const TITLE_MAX = 200

const LINE_BREAK = /\r?\n/
const LIST_MARKER = /^(?:[-*•]|\d+[.)])\s+/
const CHECKBOX = /^\[[ xX]?\]\s*/

/**
 * Turns pasted or typed text into task titles, one per line. Blank lines and
 * list markers ("-", "*", "•", "1.", "2)", "[ ]") are ignored so a list copied
 * from notes works as-is.
 */
export function parseTaskLines(text: string): string[] {
  return text
    .split(LINE_BREAK)
    .map((line) =>
      line
        .trim()
        .replace(LIST_MARKER, '')
        .replace(CHECKBOX, '')
        .trim()
        .slice(0, TITLE_MAX),
    )
    .filter((line) => line.length > 0)
}

export async function updateTask(
  id: string,
  changes: TaskChanges,
): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .update(changes)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export type TaskGroup = {
  /** null for standalone chores and obligations. */
  project: Project | null
  tasks: Task[]
}

/**
 * Groups open tasks under their project: active projects first, then paused,
 * then standalone chores. Tasks for finished or archived projects are left
 * out, and active projects with no tasks still appear so they can get one.
 */
export function groupTasks(tasks: Task[], projects: Project[]): TaskGroup[] {
  const byProject = new Map<string | null, Task[]>()
  for (const task of tasks) {
    const list = byProject.get(task.project_id) ?? []
    list.push(task)
    byProject.set(task.project_id, list)
  }

  const groups: TaskGroup[] = []
  for (const status of ['active', 'paused'] as const) {
    for (const project of projects.filter((p) => p.status === status)) {
      const projectTasks = byProject.get(project.id) ?? []
      if (status === 'active' || projectTasks.length > 0) {
        groups.push({ project, tasks: projectTasks })
      }
    }
  }
  groups.push({ project: null, tasks: byProject.get(null) ?? [] })
  return groups
}

const dueFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

/** e.g. "25 min · Low energy · Essential · Due Oct 3" */
export function describeTask(task: Task): string {
  const parts = [
    formatMinutes(task.estimated_minutes),
    ENERGY_LABELS[task.energy],
    IMPORTANCE_LABELS[task.importance],
  ]
  if (task.due_date) {
    // due_date is a plain date; format it in UTC so it never shifts a day.
    parts.push(
      `Due ${dueFormat.format(new Date(`${task.due_date}T00:00:00Z`))}`,
    )
  }
  return parts.join(' · ')
}
