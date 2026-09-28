import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createProject,
  fetchProjects,
  parkAsIdea,
  updateProject,
  type NewProject,
  type ProjectChanges,
} from '../../lib/projects'

export const projectsKey = ['projects'] as const

export function useProjects() {
  return useQuery({ queryKey: projectsKey, queryFn: fetchProjects })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (project: NewProject) => createProject(project),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectsKey }),
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: ProjectChanges }) =>
      updateProject(id, changes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectsKey }),
  })
}

export function useParkIdea() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ text, notes }: { text: string; notes?: string }) =>
      parkAsIdea(text, notes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ideas'] }),
  })
}
