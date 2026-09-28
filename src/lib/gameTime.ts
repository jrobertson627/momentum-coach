import { supabase } from './supabase'

/** Current game-time balance in minutes (0 before anything is earned). */
export async function fetchGameTimeBalance(): Promise<number> {
  const { data, error } = await supabase
    .from('reward_balances')
    .select('minutes')
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data?.minutes ?? 0
}

/**
 * Spends game time. The database refuses anything that would take the
 * balance below zero.
 */
export async function spendGameTime(
  minutes: number,
  note?: string,
): Promise<void> {
  const { error } = await supabase.from('reward_ledger').insert({
    minutes: -minutes,
    reason: 'game_time',
    note: note || null,
  })
  if (error) {
    throw new Error(
      error.message.includes('Not enough game-time credits')
        ? 'That’s more game time than you have right now.'
        : error.message,
    )
  }
}
