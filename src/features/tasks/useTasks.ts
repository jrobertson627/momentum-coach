import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createTask,
  createTasks,
  deleteTask,
  fetchOpenTasks,
  updateTask,
  type TaskChanges,
  type TaskFields,
} from '../../lib/tasks'

export const tasksKey = ['tasks'] as const

export function useOpenTasks() {
  return useQuery({ queryKey: tasksKey, queryFn: fetchOpenTasks })
}

export function useCreateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (task: TaskFields) => createTask(task),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tasksKey }),
  })
}

export function useCreateTasks() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (tasks: TaskFields[]) => createTasks(tasks),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tasksKey }),
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: TaskChanges }) =>
      updateTask(id, changes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tasksKey }),
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tasksKey }),
  })
}
