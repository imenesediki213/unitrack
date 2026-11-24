import { supabase, unwrap } from '../lib/supabase'
import type { Theme } from '../lib/types'

const THEME_COLUMNS = `
  id, title, description, capacity, status, refusal_reason, proposed_by,
  professor:profiles!professor_id(id, full_name),
  proposer:profiles!proposed_by(id, full_name)
`

export interface ThemeInput {
  title: string
  description: string
  capacity: number
  professor_id: string
}

/** The database returns the open themes, plus the others that concern the user. */
export function listThemes(): Promise<Theme[]> {
  return unwrap(supabase.from('themes').select(THEME_COLUMNS).order('title'))
}

export function addTheme(input: ThemeInput): Promise<void> {
  return unwrap(supabase.from('themes').insert(input))
}

/** Sends a pending or refused theme to the admin again. */
export function updateTheme(id: string, input: Omit<ThemeInput, 'professor_id'>): Promise<void> {
  return unwrap(supabase.from('themes').update(input).eq('id', id))
}

export function removeTheme(id: string): Promise<void> {
  return unwrap(supabase.from('themes').delete().eq('id', id))
}

export function reviewTheme(id: string, accepted: boolean, reason: string | null): Promise<void> {
  return unwrap(supabase.rpc('review_theme', { theme: id, accepted, reason }))
}
