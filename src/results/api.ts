import { supabase, unwrap } from '../lib/supabase'
import type { Result } from '../lib/types'

/** The database returns the results that the user may see. */
export function listResults(): Promise<Result[]> {
  return unwrap(supabase.from('results').select('project_id, mark, remarks'))
}

export function addResult(result: Result): Promise<void> {
  return unwrap(supabase.from('results').insert(result))
}

export function correctResult({ project_id, mark, remarks }: Result): Promise<void> {
  return unwrap(supabase.from('results').update({ mark, remarks }).eq('project_id', project_id))
}
