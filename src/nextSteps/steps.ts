import { isOpen, rolesToInvite } from '../jury/rules'
import type {
  Account,
  Defense,
  JuryInvitation,
  LastMessage,
  Profile,
  Project,
  ReportVersion,
  Result,
  Settings,
  Theme,
  ThemeRequest,
  TimeSlot,
} from '../lib/types'
import { isJuryComplete } from '../projects/jury'

/** Something to do, or to wait for. The texts are in the message files. */
export type Step =
  | {
      type:
        | 'chooseTheme'
        | 'themesClosed'
        | 'waitRequests'
        | 'waitReview'
        | 'waitDefense'
        | 'inviteJury'
        | 'waitJury'
        | 'giveAvailability'
        | 'readResult'
        | 'finished'
    }
  | { type: CountedStep; count: number }
  | { type: 'submitReport'; deadline: string | null }
  | { type: 'submitChanges'; version: number }
  | { type: 'prepareDefense'; day: string }
  | { type: 'reviewReport' | 'answerMessage' | 'enterResult'; projectId: string; title: string }

export type CountedStep =
  | 'answerIdeas'
  | 'answerRequests'
  | 'answerInvitations'
  | 'reviewThemes'
  | 'giveRoles'
  | 'confirmJuries'
  | 'studentsWithoutProject'
  | 'scheduleProjects'
  | 'markDefended'
  | 'publishResults'

export interface StudentData {
  me: Profile
  project: Project | null
  settings: Settings
  requests: ThemeRequest[]
  /** The newest first. */
  versions: ReportVersion[]
  invitations: JuryInvitation[]
  lastMessages: LastMessage[]
  defenses: Defense[]
  slots: TimeSlot[]
  results: Result[]
}

export function studentSteps(data: StudentData): Step[] {
  const { project, settings } = data
  if (!project) {
    if (data.requests.some(({ status }) => status === 'pending')) return [{ type: 'waitRequests' }]
    return [{ type: settings.themes_open ? 'chooseTheme' : 'themesClosed' }]
  }

  const steps = [reportStep(project, data)]
  if (data.lastMessages.some(({ author_id }) => author_id === project.supervisor.id)) {
    steps.push({ type: 'answerMessage', projectId: project.id, title: project.title })
  }
  const jury = juryStep(project, data)
  if (jury) steps.push(jury)
  return steps
}

function reportStep(project: Project, data: StudentData): Step {
  if (project.status === 'defended') {
    const isPublished = data.results.some(({ project_id }) => project_id === project.id)
    return { type: isPublished ? 'readResult' : 'finished' }
  }
  if (project.status === 'submitted') return { type: 'waitReview' }
  if (project.status === 'approved') {
    const defense = data.defenses.find(({ project_id }) => project_id === project.id)
    const slot = data.slots.find(({ id }) => id === defense?.slot_id)
    return slot ? { type: 'prepareDefense', day: slot.day } : { type: 'waitDefense' }
  }

  const latest = data.versions[0]
  if (latest) return { type: 'submitChanges', version: latest.version_number + 1 }
  return { type: 'submitReport', deadline: data.settings.report_deadline }
}

function juryStep(project: Project, { settings, invitations }: StudentData): Step | null {
  if (project.status === 'defended' || isJuryComplete(project.jury)) return null

  const hasExaminer =
    project.jury.some(({ role }) => role === 'examiner') ||
    invitations.some((item) => isOpen(item) && item.jury_role === 'examiner')
  const needsInvitation = rolesToInvite(project, invitations).includes('president') || !hasExaminer
  return { type: settings.jury_open && needsInvitation ? 'inviteJury' : 'waitJury' }
}

export interface ProfessorData {
  me: Profile
  themes: Theme[]
  requests: ThemeRequest[]
  invitations: JuryInvitation[]
  projects: Project[]
  lastMessages: LastMessage[]
  slots: TimeSlot[]
  results: Result[]
  /** Ids of the slots when the professor is available. */
  availableSlots: Set<string>
}

export function professorSteps(data: ProfessorData): Step[] {
  const { me } = data
  const supervised = data.projects.filter(({ supervisor }) => supervisor.id === me.id)
  const steps: Step[] = []

  for (const { id, title, status } of supervised) {
    if (status === 'submitted') steps.push({ type: 'reviewReport', projectId: id, title })
  }
  for (const { id, title, students } of supervised) {
    const last = data.lastMessages.find(({ project_id }) => project_id === id)
    if (students.some((student) => student.id === last?.author_id)) {
      steps.push({ type: 'answerMessage', projectId: id, title })
    }
  }

  for (const { id, title, status, jury } of data.projects) {
    const isPresident = jury.some(({ role, person }) => role === 'president' && person.id === me.id)
    const hasResult = data.results.some(({ project_id }) => project_id === id)
    if (status === 'defended' && isPresident && !hasResult) {
      steps.push({ type: 'enterResult', projectId: id, title })
    }
  }

  const ideas = data.themes.filter(
    ({ status, professor }) => status === 'proposed' && professor.id === me.id,
  )
  const requests = data.requests.filter(
    ({ status, theme }) => status === 'pending' && theme.professor.id === me.id,
  )
  const invitations = data.invitations.filter(
    ({ status, professor }) => status === 'pending' && professor.id === me.id,
  )
  steps.push(
    { type: 'answerRequests', count: requests.length },
    { type: 'answerIdeas', count: ideas.length },
    { type: 'answerInvitations', count: invitations.length },
  )

  const mustAttend = data.projects.some(
    ({ status, supervisor, jury }) =>
      status !== 'defended' &&
      (supervisor.id === me.id || jury.some(({ person }) => person.id === me.id)),
  )
  if (mustAttend && data.slots.length > 0 && data.availableSlots.size === 0) {
    steps.push({ type: 'giveAvailability' })
  }
  return steps.filter(isUseful)
}

export interface AdminData extends ProfessorData {
  accounts: Account[]
  studentsWithoutProject: number
  settings: Settings
  defenses: Defense[]
  /** ISO date, for example "2027-06-15" */
  today: string
}

/** What only the admin does. The admin can also have the steps of a professor. */
export function adminSteps(data: AdminData): Step[] {
  const { projects, defenses } = data
  const approved = projects.filter(({ status }) => status === 'approved')
  const dayOfSlot = new Map(data.slots.map(({ id, day }) => [id, day]))
  const dayOfProject = new Map(
    defenses.map(({ project_id, slot_id }) => [project_id, dayOfSlot.get(slot_id)]),
  )
  const isPast = (day: string | undefined) => day !== undefined && day < data.today
  const toConfirm = new Set(
    data.invitations.filter(({ status }) => status === 'accepted').map((item) => item.project_id),
  )

  const counts: [CountedStep, number][] = [
    ['giveRoles', data.accounts.filter(({ role }) => role === null).length],
    ['reviewThemes', data.themes.filter(({ status }) => status === 'pending').length],
    ['studentsWithoutProject', data.studentsWithoutProject],
    ['confirmJuries', toConfirm.size],
    ['scheduleProjects', approved.filter(({ id }) => !dayOfProject.has(id)).length],
    ['markDefended', approved.filter(({ id }) => isPast(dayOfProject.get(id))).length],
    ['publishResults', data.settings.results_published ? 0 : data.results.length],
  ]
  return counts.map(([type, count]) => ({ type, count })).filter(isUseful)
}

function isUseful(step: Step): boolean {
  return !('count' in step) || step.count > 0
}
