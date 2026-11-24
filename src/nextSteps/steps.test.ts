import { describe, expect, it } from 'vitest'
import type { Project, ProjectStatus, ReportVersion, ThemeRequest } from '../lib/types'
import {
  adminSteps,
  professorSteps,
  studentSteps,
  type AdminData,
  type StudentData,
} from './steps'

const professor = { id: 'professor', full_name: '', role: 'supervisor' as const }
const student = { id: 'student', full_name: '', role: 'student' as const }

function project(status: ProjectStatus, changes: Partial<Project> = {}): Project {
  return {
    id: 'project',
    title: 'Title',
    status,
    supervisor: professor,
    students: [student],
    jury: [
      { role: 'president', person: { id: 'a', full_name: '' } },
      { role: 'examiner', person: { id: 'b', full_name: '' } },
    ],
    description: null,
    ...changes,
  }
}

const settings = {
  max_defenses_per_day: 3,
  schedule_published: true,
  themes_open: true,
  jury_open: true,
  report_deadline: null,
}

const slots = [{ id: 'slot', day: '2027-06-14', start_time: '09:00', end_time: '10:00' }]
const defenses = [{ project_id: 'project', slot_id: 'slot', room_id: 'room' }]

function studentTypes(changes: Partial<StudentData>) {
  const steps = studentSteps({
    me: student,
    project: null,
    settings,
    requests: [],
    versions: [],
    invitations: [],
    lastMessages: [],
    defenses: [],
    slots,
    ...changes,
  })
  return steps.map(({ type }) => type)
}

describe('studentSteps', () => {
  it('starts with a theme', () => {
    expect(studentTypes({})).toEqual(['chooseTheme'])
    expect(studentTypes({ settings: { ...settings, themes_open: false } })).toEqual(['themesClosed'])

    const request = { status: 'pending' } as ThemeRequest
    expect(studentTypes({ requests: [request] })).toEqual(['waitRequests'])
  })

  it('follows the report', () => {
    const version = { version_number: 1 } as ReportVersion

    expect(studentTypes({ project: project('in_progress') })).toEqual(['submitReport'])
    expect(studentTypes({ project: project('in_progress'), versions: [version] })).toEqual([
      'submitChanges',
    ])
    expect(studentTypes({ project: project('submitted') })).toEqual(['waitReview'])
  })

  it('ends with the defense', () => {
    expect(studentTypes({ project: project('approved') })).toEqual(['waitDefense'])
    expect(studentTypes({ project: project('approved'), defenses })).toEqual(['prepareDefense'])
    expect(studentTypes({ project: project('defended') })).toEqual(['finished'])
  })

  it('asks for a jury until enough people are invited', () => {
    const noJury = project('submitted', { jury: [] })
    const invitation = (jury_role: 'president' | 'examiner') => ({
      id: jury_role,
      project_id: 'project',
      status: 'pending' as const,
      jury_role,
      reply: null,
      professor,
    })
    const president = invitation('president')

    expect(studentTypes({ project: noJury, invitations: [president] })).toContain('inviteJury')
    expect(
      studentTypes({ project: noJury, invitations: [president, invitation('examiner')] }),
    ).toContain('waitJury')
    expect(
      studentTypes({ project: noJury, settings: { ...settings, jury_open: false } }),
    ).toContain('waitJury')
  })

  it('shows a message of the supervisor, not one of the student', () => {
    const from = (author_id: string) => [{ project_id: 'project', author_id }]

    expect(studentTypes({ project: project('submitted'), lastMessages: from(professor.id) })).toContain(
      'answerMessage',
    )
    expect(
      studentTypes({ project: project('submitted'), lastMessages: from(student.id) }),
    ).not.toContain('answerMessage')
  })
})

const nothing: AdminData = {
  me: professor,
  themes: [],
  requests: [],
  invitations: [],
  projects: [],
  lastMessages: [],
  slots,
  availableSlots: new Set(),
  accounts: [],
  studentsWithoutProject: 0,
  defenses: [],
  today: '2027-06-14',
}

describe('professorSteps', () => {
  it('is empty when nothing waits', () => {
    expect(professorSteps(nothing)).toEqual([])
  })

  it('lists the reports, the messages and a missing availability', () => {
    const data = {
      ...nothing,
      projects: [project('submitted')],
      lastMessages: [{ project_id: 'project', author_id: student.id }],
    }

    expect(professorSteps(data).map(({ type }) => type)).toEqual([
      'reviewReport',
      'answerMessage',
      'giveAvailability',
    ])
  })

  it('leaves out the projects of colleagues', () => {
    const colleague = { id: 'colleague', full_name: '' }
    const projects = [project('submitted', { supervisor: colleague })]
    expect(professorSteps({ ...nothing, projects })).toEqual([])
  })
})

describe('adminSteps', () => {
  it('asks to mark a defense only after its day', () => {
    const data = { ...nothing, projects: [project('approved')], defenses }

    expect(adminSteps(data)).toEqual([])
    expect(adminSteps({ ...data, today: '2027-06-15' })).toEqual([
      { type: 'markDefended', count: 1 },
    ])
  })

  it('counts approved projects without a slot', () => {
    expect(adminSteps({ ...nothing, projects: [project('approved')] })).toEqual([
      { type: 'scheduleProjects', count: 1 },
    ])
  })
})
