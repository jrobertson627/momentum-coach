/**
 * The recommendation engine: picks the one task that best fits right now.
 *
 * Pure and deterministic: no UI, database, or clock access (the caller passes
 * `now`). Inputs are plain data, so this can be unit-tested exhaustively and
 * later ported to another language or run on a server unchanged.
 *
 * Each candidate gets a set of factor scores in [0, 1]. A task's score is the
 * weighted sum of its factors; the highest score wins. The factors are returned
 * so the UI can explain the pick (#12).
 */

export type Energy = 'low' | 'medium' | 'high'

export type EngineTask = {
  id: string
  project_id: string | null
  title: string
  estimated_minutes: number
  energy: Energy
  importance: number
  /** Plain date, `YYYY-MM-DD`. */
  due_date: string | null
  smaller_version: string | null
  status: 'open' | 'done'
  deferred_until: string | null
  created_at: string
}

export type EngineProject = {
  id: string
  name: string
  status: 'active' | 'paused' | 'finished' | 'archived'
  created_at: string
}

export type EngineEvent = {
  task_id: string
  /** The task's project at the time, so progress counts after a task is done. */
  project_id: string | null
  kind: 'completed' | 'skipped' | 'deferred'
  created_at: string
}

export type CheckIn = { minutes: number; energy: Energy }

export type RecommendInput<T extends EngineTask = EngineTask> = {
  tasks: T[]
  projects: EngineProject[]
  /** Recent history; a few weeks is plenty. */
  events: EngineEvent[]
  checkIn: CheckIn
  now: Date
}

export type Factor =
  | { key: 'fitsTime'; score: number; minutes: number; available: number }
  | { key: 'energyMatch'; score: number; task: Energy; available: Energy }
  | { key: 'importance'; score: number; importance: number }
  | { key: 'deadline'; score: number; daysUntilDue: number }
  | {
      key: 'neglect'
      score: number
      projectName: string
      daysSinceProgress: number
    }
  | { key: 'postponed'; score: number; times: number }
  | { key: 'recentlySkipped'; score: number }

export type FactorKey = Factor['key']

export type WeightedFactor = Factor & {
  weight: number
  /** weight × score: what this factor added to (or took from) the total. */
  contribution: number
}

export type Recommendation<T extends EngineTask = EngineTask> = {
  task: T
  /** The task is too big right now, so its smaller version is suggested. */
  useSmallerVersion: boolean
  score: number
  /** Sorted by contribution, biggest first. */
  factors: WeightedFactor[]
}

export type EngineConfig = {
  weights: Record<FactorKey, number>
  /** Days without progress at which a project counts as fully neglected. */
  neglectFullAfterDays: number
  /** Deadlines further away than this add nothing. */
  deadlineHorizonDays: number
  /** Skips within this window push a task down so "skip" shows something new. */
  recentSkipHours: number
  /** Skips and deferrals older than that; the count at which it maxes out. */
  postponedFullAt: number
  /** Score multiplier for a task only offered through its smaller version. */
  smallerVersionPenalty: number
}

export const DEFAULT_CONFIG: EngineConfig = {
  weights: {
    fitsTime: 1,
    energyMatch: 1,
    importance: 2,
    deadline: 3,
    neglect: 1.5,
    postponed: 0.75,
    recentlySkipped: -6,
  },
  neglectFullAfterDays: 7,
  deadlineHorizonDays: 14,
  recentSkipHours: 6,
  postponedFullAt: 3,
  smallerVersionPenalty: 0.8,
}

const ENERGY_RANK: Record<Energy, number> = { low: 0, medium: 1, high: 2 }
const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** Whole days from a to b, by calendar date in UTC. */
function daysBetween(a: Date, b: Date): number {
  const start = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate())
  const end = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate())
  return Math.round((end - start) / DAY_MS)
}

/**
 * Tasks you could start now: open, not deferred, and belonging to an active
 * project or to none. Paused, finished and archived projects rest on purpose.
 */
export function eligibleTasks<T extends EngineTask>(
  tasks: T[],
  projects: EngineProject[],
  now: Date,
): T[] {
  const active = new Set(
    projects.filter((p) => p.status === 'active').map((p) => p.id),
  )
  return tasks.filter(
    (task) =>
      task.status === 'open' &&
      (task.project_id === null || active.has(task.project_id)) &&
      (!task.deferred_until || new Date(task.deferred_until) <= now),
  )
}

/** Whether a task fits as-is, only via its smaller version, or not at all. */
export function fitFor(
  task: EngineTask,
  checkIn: CheckIn,
): 'full' | 'smaller' | null {
  const fitsTime = task.estimated_minutes <= checkIn.minutes
  const fitsEnergy = ENERGY_RANK[task.energy] <= ENERGY_RANK[checkIn.energy]
  if (fitsTime && fitsEnergy) return 'full'
  return task.smaller_version ? 'smaller' : null
}

type ScoringContext = {
  checkIn: CheckIn
  now: Date
  events: EngineEvent[]
  projectById: Map<string, EngineProject>
  /** Latest completion per project: "progress". */
  lastProgress: Map<string, Date>
  config: EngineConfig
}

function scoringContext(
  input: RecommendInput<EngineTask>,
  config: EngineConfig,
): ScoringContext {
  const lastProgress = new Map<string, Date>()
  for (const event of input.events) {
    if (event.kind !== 'completed' || !event.project_id) continue
    const at = new Date(event.created_at)
    const prev = lastProgress.get(event.project_id)
    if (!prev || at > prev) lastProgress.set(event.project_id, at)
  }
  return {
    checkIn: input.checkIn,
    now: input.now,
    events: input.events,
    projectById: new Map(input.projects.map((p) => [p.id, p])),
    lastProgress,
    config,
  }
}

function scoreTask<T extends EngineTask>(
  task: T,
  useSmallerVersion: boolean,
  { checkIn, now, events, projectById, lastProgress, config }: ScoringContext,
): Recommendation<T> {
  const factors: Factor[] = []

  // Time: using more of the window well scores higher; a smaller version is
  // a short step, so it gets a middling score.
  factors.push({
    key: 'fitsTime',
    score: useSmallerVersion
      ? 0.5
      : 0.5 + 0.5 * clamp01(task.estimated_minutes / checkIn.minutes),
    minutes: task.estimated_minutes,
    available: checkIn.minutes,
  })

  // Energy: a task that matches your energy uses it well; easier is fine.
  const gap = ENERGY_RANK[checkIn.energy] - ENERGY_RANK[task.energy]
  factors.push({
    key: 'energyMatch',
    score: useSmallerVersion ? 0.6 : gap <= 0 ? 1 : gap === 1 ? 0.7 : 0.5,
    task: task.energy,
    available: checkIn.energy,
  })

  factors.push({
    key: 'importance',
    score: clamp01((task.importance - 1) / 2),
    importance: task.importance,
  })

  if (task.due_date) {
    const daysUntilDue = daysBetween(
      now,
      new Date(`${task.due_date}T00:00:00Z`),
    )
    factors.push({
      key: 'deadline',
      score: clamp01(1 - daysUntilDue / config.deadlineHorizonDays),
      daysUntilDue,
    })
  }

  const project = task.project_id ? projectById.get(task.project_id) : null
  if (project) {
    const since = lastProgress.get(project.id) ?? new Date(project.created_at)
    const daysSinceProgress = Math.max(0, daysBetween(since, now))
    factors.push({
      key: 'neglect',
      score: clamp01(daysSinceProgress / config.neglectFullAfterDays),
      projectName: project.name,
      daysSinceProgress,
    })
  }

  let recentSkips = 0
  let olderPostponements = 0
  for (const event of events) {
    if (event.task_id !== task.id || event.kind === 'completed') continue
    const ageHours =
      (now.getTime() - new Date(event.created_at).getTime()) / HOUR_MS
    if (event.kind === 'skipped' && ageHours < config.recentSkipHours) {
      recentSkips++
    } else {
      olderPostponements++
    }
  }
  if (olderPostponements > 0) {
    factors.push({
      key: 'postponed',
      score: clamp01(olderPostponements / config.postponedFullAt),
      times: olderPostponements,
    })
  }
  if (recentSkips > 0) {
    factors.push({ key: 'recentlySkipped', score: 1 })
  }

  const weighted = factors
    .map((factor) => {
      const weight = config.weights[factor.key]
      return { ...factor, weight, contribution: weight * factor.score }
    })
    .sort((a, b) => b.contribution - a.contribution)

  const total = weighted.reduce((sum, f) => sum + f.contribution, 0)
  return {
    task,
    useSmallerVersion,
    score: useSmallerVersion ? total * config.smallerVersionPenalty : total,
    factors: weighted,
  }
}

/** Every task that fits, best first. */
export function rankTasks<T extends EngineTask>(
  input: RecommendInput<T>,
  config: EngineConfig = DEFAULT_CONFIG,
): Recommendation<T>[] {
  const context = scoringContext(input, config)
  const ranked: Recommendation<T>[] = []
  for (const task of eligibleTasks(input.tasks, input.projects, input.now)) {
    const fit = fitFor(task, input.checkIn)
    if (fit) ranked.push(scoreTask(task, fit === 'smaller', context))
  }

  // Highest score first; ties go to the task that has waited longest, then id,
  // so the same input always gives the same answer.
  return ranked.sort(
    (a, b) =>
      b.score - a.score ||
      a.task.created_at.localeCompare(b.task.created_at) ||
      a.task.id.localeCompare(b.task.id),
  )
}

/** The single best task for right now, or null if nothing fits. */
export function recommend<T extends EngineTask>(
  input: RecommendInput<T>,
  config: EngineConfig = DEFAULT_CONFIG,
): Recommendation<T> | null {
  return rankTasks(input, config)[0] ?? null
}

/** A smaller version counts as a short, low-energy step. */
const SMALLER_VERSION_MINUTES = 10

/** How much a pick asks of you: energy first, then time. */
function effort(r: Recommendation): number {
  if (r.useSmallerVersion) return SMALLER_VERSION_MINUTES
  return ENERGY_RANK[r.task.energy] * 1000 + r.task.estimated_minutes
}

const LOWER_ENERGY: Record<Energy, Energy> = {
  high: 'medium',
  medium: 'low',
  low: 'low',
}

export type EasierAlternative<T extends EngineTask> = {
  recommendation: Recommendation<T>
  /** The check-in it was chosen for; pass it back in to go easier again. */
  checkIn: CheckIn
}

/**
 * "Too much right now": something that asks less of you than `current`.
 *
 * 1. The current task's smaller version, if it has one.
 * 2. Otherwise the best pick with one energy level less, among tasks that ask
 *    less than the current one and haven't been shown yet (`exclude`).
 *
 * Returns null when there is nothing lighter; that's a good moment to rest.
 */
export function easierAlternative<T extends EngineTask>(
  input: RecommendInput<T>,
  current: Recommendation<T>,
  exclude: ReadonlySet<string> = new Set(),
  config: EngineConfig = DEFAULT_CONFIG,
): EasierAlternative<T> | null {
  if (!current.useSmallerVersion && current.task.smaller_version) {
    return {
      recommendation: scoreTask(
        current.task,
        true,
        scoringContext(input, config),
      ),
      checkIn: input.checkIn,
    }
  }

  const checkIn = {
    ...input.checkIn,
    energy: LOWER_ENERGY[input.checkIn.energy],
  }
  const lighter = rankTasks({ ...input, checkIn }, config).find(
    (r) =>
      r.task.id !== current.task.id &&
      !exclude.has(r.task.id) &&
      effort(r) < effort(current),
  )
  return lighter ? { recommendation: lighter, checkIn } : null
}
