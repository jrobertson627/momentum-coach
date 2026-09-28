import { useMutation, useQueryClient } from '@tanstack/react-query'
import { actOnTask, type TaskAction } from '../../lib/actions'
import type { CheckIn } from '../../lib/checkIn'
import { tasksKey } from '../tasks/useTasks'
import { gameTimeKey } from './useGameTime'
import { eventsKey } from './useRecentEvents'

export function useActOnTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      taskId,
      action,
      checkIn,
    }: {
      taskId: string
      action: TaskAction
      checkIn: CheckIn
    }) => actOnTask(taskId, action, checkIn),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: tasksKey }),
        queryClient.invalidateQueries({ queryKey: eventsKey }),
        queryClient.invalidateQueries({ queryKey: gameTimeKey }),
      ]),
  })
}
