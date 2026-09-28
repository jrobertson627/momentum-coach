import type { Project } from './projects'
import type { Energy, Task } from './tasks'

/** What the user has right now: the input to every recommendation. */
export type CheckIn = {
  minutes: number
  energy: Energy
}

/** The "60+" choice: plenty of time, but still a limit worth respecting. */
export const PLENTY_OF_TIME = 120

export const TIME_OPTIONS = [
  { minutes: 10, label: '10 min' },
  { minutes: 25, label: '25 min' },
  { minutes: 45, label: '45 min' },
  { minutes: PLENTY_OF_TIME, label: '60+ min' },
] as const

export const ENERGY_OPTIONS = [
  { energy: 'low', label: 'Low' },
  { energy: 'medium', label: 'Medium' },
  { energy: 'high', label: 'High' },
] as const satisfies readonly { energy: Energy; label: string }[]

const ENERGY_RANK: Record<Energy, number> = { low: 0, medium: 1, high: 2 }

export function describeCheckIn({ minutes, energy }: CheckIn): string {
  const time =
    minutes >= PLENTY_OF_TIME ? 'an hour or more' : `${minutes} minutes`
  return `${time} and ${energy} energy`
}

/**
 * Open tasks you could actually do now: they fit the time and don't need more
 * energy than you have, aren't deferred, and belong to an active project (or
 * none). Paused, finished and archived projects are resting on purpose.
 */
export function tasksThatFit(
  tasks: Task[],
  projects: Project[],
  checkIn: CheckIn,
  now: Date = new Date(),
): Task[] {
  const active = new Set(
    projects.filter((p) => p.status === 'active').map((p) => p.id),
  )
  return tasks.filter(
    (task) =>
      task.status === 'open' &&
      (task.project_id === null || active.has(task.project_id)) &&
      (!task.deferred_until || new Date(task.deferred_until) <= now) &&
      task.estimated_minutes <= checkIn.minutes &&
      ENERGY_RANK[task.energy] <= ENERGY_RANK[checkIn.energy],
  )
}
