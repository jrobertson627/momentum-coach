import type {
  Enums,
  Tables,
  TablesInsert,
  TablesUpdate,
} from './database.types'
import { supabase } from './supabase'

export type Project = Tables<'projects'>
export type ProjectStatus = Enums<'project_status'>
export type NewProject = Pick<
  TablesInsert<'projects'>,
  'name' | 'why' | 'definition_of_done' | 'status'
>
export type ProjectChanges = Pick<
  TablesUpdate<'projects'>,
  'name' | 'why' | 'definition_of_done' | 'status' | 'finished_at'
>

/** Mirrors the database trigger in the initial migration. */
export const ACTIVE_PROJECT_LIMIT = 3

export class ActiveLimitError extends Error {
  constructor() {
    super('You already have 3 active projects')
    this.name = 'ActiveLimitError'
  }
}

function raise(error: { message: string; code?: string }): never {
  if (error.message.includes('already have 3 active projects')) {
    throw new ActiveLimitError()
  }
  throw new Error(error.message)
}

export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) raise(error)
  return data
}

export async function createProject(project: NewProject): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .insert(project)
    .select()
    .single()
  if (error) raise(error)
  return data
}

export async function updateProject(
  id: string,
  changes: ProjectChanges,
): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .update(changes)
    .eq('id', id)
    .select()
    .single()
  if (error) raise(error)
  return data
}

/** Saves a would-be project to the parking lot instead of starting it. */
export async function parkAsIdea(text: string, notes?: string): Promise<void> {
  const { error } = await supabase
    .from('ideas')
    .insert({ text, notes: notes || null })
  if (error) raise(error)
}

/** The changes that move a project to a new status. */
export function statusChange(status: ProjectStatus): ProjectChanges {
  return {
    status,
    finished_at: status === 'finished' ? new Date().toISOString() : null,
  }
}

export type GroupedProjects = Record<ProjectStatus, Project[]>

export function groupProjects(projects: Project[]): GroupedProjects {
  const groups: GroupedProjects = {
    active: [],
    paused: [],
    finished: [],
    archived: [],
  }
  for (const project of projects) groups[project.status].push(project)
  return groups
}
