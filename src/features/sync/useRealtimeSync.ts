import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { ideasKey } from '../ideas/useIdeas'
import { gameTimeKey } from '../now/useGameTime'
import { eventsKey } from '../now/useRecentEvents'
import { projectsKey } from '../projects/useProjects'
import { tasksKey } from '../tasks/useTasks'

/** Which cached queries go stale when a table changes. */
export const TABLE_QUERY_KEYS: Record<string, QueryKey> = {
  projects: projectsKey,
  ideas: ideasKey,
  tasks: tasksKey,
  task_events: eventsKey,
  reward_ledger: gameTimeKey,
}

/** Changes often arrive in bursts (a completion touches three tables). */
const BATCH_MS = 200

/**
 * Keeps this device in sync with changes made elsewhere: listens to Supabase
 * Realtime and refetches whatever changed. Row-level security means only the
 * signed-in user's changes arrive. After a dropped connection comes back,
 * everything is refetched in case changes were missed while offline.
 */
export function useRealtimeSync(userId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const pending = new Set<string>()
    let timer: ReturnType<typeof setTimeout> | undefined
    let subscribedBefore = false

    function flush() {
      for (const table of pending) {
        void queryClient.invalidateQueries({
          queryKey: TABLE_QUERY_KEYS[table],
        })
      }
      pending.clear()
    }

    function changed(table: string) {
      pending.add(table)
      clearTimeout(timer)
      timer = setTimeout(flush, BATCH_MS)
    }

    const channel = supabase.channel(`sync:${userId}`)
    for (const table of Object.keys(TABLE_QUERY_KEYS)) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => changed(table),
      )
    }
    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return
      if (subscribedBefore) void queryClient.invalidateQueries()
      subscribedBefore = true
    })

    return () => {
      clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [queryClient, userId])
}
