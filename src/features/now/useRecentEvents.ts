import { useQuery } from '@tanstack/react-query'
import { fetchRecentEvents } from '../../lib/events'

export const eventsKey = ['task_events'] as const

export function useRecentEvents() {
  return useQuery({ queryKey: eventsKey, queryFn: () => fetchRecentEvents() })
}
