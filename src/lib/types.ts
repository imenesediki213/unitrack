export type Role = 'student' | 'supervisor' | 'admin'

export interface Person {
  id: string
  full_name: string
}

export interface Profile extends Person {
  role: Role | null
}

export interface Account extends Profile {
  email: string
}

export type ProjectStatus = 'in_progress' | 'submitted' | 'approved' | 'defended'
export type JuryRole = 'president' | 'examiner'

export interface JuryMember {
  role: JuryRole
  person: Person
}

export interface Project {
  id: string
  title: string
  status: ProjectStatus
  supervisor: Person
  students: Person[]
  /** The president and the examiners. The supervisor is not repeated here. */
  jury: JuryMember[]
}

export type Decision = 'pending' | 'approved' | 'changes_requested'

export interface ReportVersion {
  id: string
  version_number: number
  file_path: string
  uploaded_at: string
  decision: Decision
  comment: string | null
}

export interface Room {
  id: string
  name: string
}

export interface TimeSlot {
  id: string
  day: string
  start_time: string
  end_time: string
}

export interface Defense {
  project_id: string
  slot_id: string
  room_id: string
}

export interface Settings {
  max_defenses_per_day: number
  schedule_published: boolean
}
