import type { Tables } from './database.types'
import { createProject, type NewProject, type Project } from './projects'
import { supabase } from './supabase'

export type Idea = Tables<'ideas'>

/** Prefix used when a would-be project is parked with its finish line. */
const DONE_PREFIX = 'Done when: '

/** Parked ideas that haven't become projects yet, newest first. */
export async function fetchIdeas(): Promise<Idea[]> {
  const { data, error } = await supabase
    .from('ideas')
    .select('*')
    .is('promoted_project_id', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}

export async function createIdea(text: string, notes?: string): Promise<Idea> {
  const { data, error } = await supabase
    .from('ideas')
    .insert({ text, notes: notes || null })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteIdea(id: string): Promise<void> {
  const { error } = await supabase.from('ideas').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/**
 * Starts a project from an idea and links the two, so the idea leaves the
 * parking lot. The database still enforces the 3-active limit.
 */
export async function promoteIdea(
  ideaId: string,
  project: NewProject,
): Promise<Project> {
  const created = await createProject(project)
  const { error } = await supabase
    .from('ideas')
    .update({ promoted_project_id: created.id })
    .eq('id', ideaId)
  if (error) throw new Error(error.message)
  return created
}

export function parkedNotes(definitionOfDone: string): string | undefined {
  return definitionOfDone ? `${DONE_PREFIX}${definitionOfDone}` : undefined
}

/** Splits an idea's notes into a definition of done and anything else. */
export function splitNotes(notes: string | null): {
  definitionOfDone: string
  rest: string
} {
  if (!notes) return { definitionOfDone: '', rest: '' }
  if (notes.startsWith(DONE_PREFIX)) {
    const [first, ...others] = notes.split('\n')
    return {
      definitionOfDone: first.slice(DONE_PREFIX.length).trim(),
      rest: others.join('\n').trim(),
    }
  }
  return { definitionOfDone: '', rest: notes }
}
