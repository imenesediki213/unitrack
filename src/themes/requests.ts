import { supabase, unwrap } from '../lib/supabase'
import type { Person, ThemeRequest } from '../lib/types'

const REQUEST_COLUMNS = `
  id, status, message, reply,
  student:profiles!student_id(id, full_name),
  theme:themes(id, title, professor:profiles!professor_id(id, full_name))
`

/** A student gets their own requests, a professor those for their themes. */
export function listRequests(): Promise<ThemeRequest[]> {
  return unwrap(
    supabase.from('theme_requests').select(REQUEST_COLUMNS).order('created_at', { ascending: false }),
  )
}

export function askForTheme(theme_id: string, message: string): Promise<void> {
  return unwrap(supabase.from('theme_requests').insert({ theme_id, message }))
}

export function withdrawRequest(id: string): Promise<void> {
  return unwrap(supabase.from('theme_requests').delete().eq('id', id))
}

/** Accepting creates the project and cancels the other requests of the student. */
export function answerRequest(id: string, accepted: boolean, reason: string | null): Promise<void> {
  return unwrap(supabase.rpc('answer_request', { request: id, accepted, reason }))
}

export interface StudentWithoutProject extends Person {
  theme_requests: { status: ThemeRequest['status'] }[]
}

/** For the admin. */
export function listStudentsWithoutProject(): Promise<StudentWithoutProject[]> {
  return unwrap(
    supabase
      .from('profiles')
      .select('id, full_name, theme_requests(status), project_students(project_id)')
      .eq('role', 'student')
      .is('project_students', null)
      .order('full_name'),
  )
}
