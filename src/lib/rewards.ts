/**
 * Game-time credits: finishing things earns guilt-free game time.
 *
 * Pure (no Supabase import) so the database tests can check that the
 * act_on_task function awards exactly what the UI says was earned. Changing
 * the rate means changing it here and in the reward_credits migration.
 */

/** Minutes of game time earned per minute of estimated effort. */
export const REWARD_RATE = 0.5

/** A finished first step ("smaller version") counts as this much effort. */
export const SMALLER_STEP_MINUTES = 10

export function creditsFor(effortMinutes: number): number {
  return Math.max(1, Math.ceil(effortMinutes * REWARD_RATE))
}

export function formatCredits(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}
