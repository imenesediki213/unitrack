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
  /** Null when the admin created the project directly. */
  description: string | null
}

/**
 * proposed: a student's idea, for the professor. pending: for the admin.
 * taken: it has all its students.
 */
export type ThemeStatus = 'proposed' | 'pending' | 'open' | 'refused' | 'taken'

export interface Theme {
  id: string
  title: string
  description: string
  /** How many students can take it. */
  capacity: number
  status: ThemeStatus
  refusal_reason: string | null
  professor: Person
  /** The student who had the idea, if it is one. */
  proposed_by: string | null
  /** Null when the user may not see who proposed it. */
  proposer: Person | null
}

export type RequestStatus = 'pending' | 'accepted' | 'refused' | 'cancelled'

export interface ThemeRequest {
  id: string
  status: RequestStatus
  /** Empty when the theme is the student's own idea. */
  message: string | null
  reply: string | null
  student: Person
  theme: { id: string; title: string; professor: Person }
}

/** accepted: by the professor. confirmed: by the admin, so the professor is in the jury. */
export type InvitationStatus = 'pending' | 'accepted' | 'refused' | 'confirmed' | 'cancelled'

export interface JuryInvitation {
  id: string
  project_id: string
  jury_role: JuryRole
  status: InvitationStatus
  reply: string | null
  professor: Person
}

export interface JuryLoad {
  professor_id: string
  confirmed: number
  /** Invitations that can still lead to a seat. */
  waiting: number
}

export interface Message {
  id: string
  body: string
  created_at: string
  /** Null when the user may no longer see that person. */
  author: Person | null
}

export interface LastMessage {
  project_id: string
  author_id: string
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
  /** Students can ask for themes and propose their own. */
  themes_open: boolean
  /** Students and supervisors can invite jury members. */
  jury_open: boolean
  /** The moment when a report becomes late. */
  report_deadline: string | null
}
