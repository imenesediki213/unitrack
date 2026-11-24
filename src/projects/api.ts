import { supabase, unwrap } from '../lib/supabase'
import type { JuryRole, Person, Project, ProjectStatus } from '../lib/types'

const PROJECT_COLUMNS = `
  id, title, status,
  supervisor:profiles!supervisor_id(id, full_name),
  project_students(student:profiles(id, full_name)),
  jury_members(jury_role, professor:profiles(id, full_name)),
  theme:themes(description)
`

interface ProjectRow {
  id: string
  title: string
  status: ProjectStatus
  supervisor: Person
  project_students: { student: Person }[]
  jury_members: { jury_role: JuryRole; professor: Person }[]
  theme: { description: string } | null
}

/** The database returns only the projects that the user may see. */
export async function listProjects(): Promise<Project[]> {
  const rows = await unwrap<ProjectRow[]>(
    supabase.from('projects').select(PROJECT_COLUMNS).order('title'),
  )
  return rows.map(toProject)
}

export async function getProject(id: string): Promise<Project> {
  const row = await unwrap<ProjectRow>(
    supabase.from('projects').select(PROJECT_COLUMNS).eq('id', id).single(),
  )
  return toProject(row)
}

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    supervisor: row.supervisor,
    students: row.project_students.map(({ student }) => student),
    jury: row.jury_members
      .map(({ jury_role, professor }) => ({ role: jury_role, person: professor }))
      .sort((a, b) => b.role.localeCompare(a.role)),
    description: row.theme?.description ?? null,
  }
}

export interface ProjectInput {
  title: string
  supervisor_id: string
}

export async function createProject(input: ProjectInput): Promise<string> {
  const row = await unwrap<{ id: string }>(
    supabase.from('projects').insert(input).select('id').single(),
  )
  return row.id
}

export function updateProject(id: string, input: ProjectInput): Promise<void> {
  return unwrap(supabase.from('projects').update(input).eq('id', id))
}

export function deleteProject(id: string): Promise<void> {
  return unwrap(supabase.from('projects').delete().eq('id', id))
}

export function markDefended(id: string): Promise<void> {
  return unwrap(supabase.rpc('mark_defended', { project: id }))
}

export function addStudent(project_id: string, student_id: string): Promise<void> {
  return unwrap(supabase.from('project_students').insert({ project_id, student_id }))
}

export function removeStudent(projectId: string, studentId: string): Promise<void> {
  return unwrap(
    supabase
      .from('project_students')
      .delete()
      .eq('project_id', projectId)
      .eq('student_id', studentId),
  )
}

export function addJuryMember(
  project_id: string,
  professor_id: string,
  jury_role: JuryRole,
): Promise<void> {
  return unwrap(supabase.from('jury_members').insert({ project_id, professor_id, jury_role }))
}

export function removeJuryMember(projectId: string, professorId: string): Promise<void> {
  return unwrap(
    supabase
      .from('jury_members')
      .delete()
      .eq('project_id', projectId)
      .eq('professor_id', professorId),
  )
}
