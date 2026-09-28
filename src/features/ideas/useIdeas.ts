import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createIdea,
  deleteIdea,
  fetchIdeas,
  promoteIdea,
} from '../../lib/ideas'
import type { NewProject } from '../../lib/projects'
import { projectsKey } from '../projects/useProjects'

export const ideasKey = ['ideas'] as const

export function useIdeas() {
  return useQuery({ queryKey: ideasKey, queryFn: fetchIdeas })
}

export function useCreateIdea() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ text, notes }: { text: string; notes?: string }) =>
      createIdea(text, notes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ideasKey }),
  })
}

export function useDeleteIdea() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteIdea(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ideasKey }),
  })
}

export function usePromoteIdea() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, project }: { id: string; project: NewProject }) =>
      promoteIdea(id, project),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ideasKey }),
        queryClient.invalidateQueries({ queryKey: projectsKey }),
      ]),
  })
}
