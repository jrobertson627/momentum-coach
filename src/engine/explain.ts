/**
 * Turns a recommendation's top factors into one calm sentence, e.g.
 * "Recommended because it fits your 25 minutes, matches your energy, and moves
 * Workout tracker forward after 6 quiet days."
 *
 * Tone rules: describe, don't judge. No "overdue", no exclamation marks, no
 * streaks or counts of how often something was put off.
 */
import type { Factor, Recommendation, WeightedFactor } from './recommend'

/** Factors adding less than this aren't worth mentioning. */
const MIN_CONTRIBUTION = 0.3
const MAX_REASONS = 3

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

/** A verb phrase that follows "it", or null if the factor isn't worth saying. */
export function reasonFor(
  factor: Factor,
  useSmallerVersion = false,
): string | null {
  switch (factor.key) {
    case 'deadline': {
      const days = factor.daysUntilDue
      if (days < 0) return 'was due earlier'
      if (days === 0) return 'is due today'
      if (days === 1) return 'is due tomorrow'
      return `is due in ${days} days`
    }
    case 'importance':
      if (factor.importance >= 3) return 'is essential'
      if (factor.importance === 2) return 'is important to you'
      return null
    case 'neglect': {
      const days = factor.daysSinceProgress
      if (days < 2) return `keeps ${factor.projectName} moving`
      return `moves ${factor.projectName} forward after ${plural(days, 'quiet day')}`
    }
    case 'fitsTime':
      if (useSmallerVersion) return 'is a small step you can start right away'
      if (factor.available >= 120) return 'fits the time you have'
      return `fits your ${factor.available} minutes`
    case 'energyMatch':
      if (useSmallerVersion) return 'is gentle on your energy'
      return factor.task === factor.available
        ? 'matches your energy'
        : 'is easy on your energy'
    case 'postponed':
      return 'has been waiting a while'
    case 'recentlySkipped':
      return null
  }
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('')
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`
}

/** The top few reasons, most influential first. */
export function topReasons(recommendation: Recommendation): string[] {
  const reasons: string[] = []
  const sorted: WeightedFactor[] = [...recommendation.factors].sort(
    (a, b) => b.contribution - a.contribution,
  )
  for (const factor of sorted) {
    if (reasons.length === MAX_REASONS) break
    if (factor.contribution < MIN_CONTRIBUTION) continue
    const reason = reasonFor(factor, recommendation.useSmallerVersion)
    if (reason && !reasons.includes(reason)) reasons.push(reason)
  }
  return reasons
}

export function explain(recommendation: Recommendation): string {
  const reasons = topReasons(recommendation)
  if (reasons.length === 0) return 'It fits what you have right now.'
  return `Recommended because it ${joinList(reasons)}.`
}
