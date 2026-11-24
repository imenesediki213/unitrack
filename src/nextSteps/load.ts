import { listAvailableSlots } from '../availability/api'
import { listLastMessages } from '../discussion/api'
import { listInvitations } from '../jury/api'
import type { Profile } from '../lib/types'
import { listAccounts } from '../people/api'
import { getSettings, listDefenses, listSlots } from '../planning/api'
import { listProjects } from '../projects/api'
import { dayOf } from '../projects/deadline'
import { listVersions } from '../projects/reports'
import { listThemes } from '../themes/api'
import { listRequests, listStudentsWithoutProject } from '../themes/requests'
import { adminSteps, professorSteps, studentSteps, type ProfessorData, type Step } from './steps'

export async function loadSteps(me: Profile): Promise<Step[]> {
  if (me.role === 'student') return loadStudentSteps(me)

  const data = await loadProfessorData(me)
  if (me.role !== 'admin') return professorSteps(data)

  const [accounts, students, defenses] = await Promise.all([
    listAccounts(),
    listStudentsWithoutProject(),
    listDefenses(),
  ])
  const adminData = {
    ...data,
    accounts,
    defenses,
    studentsWithoutProject: students.length,
    today: dayOf(new Date().toISOString()),
  }
  return [...adminSteps(adminData), ...professorSteps(data)]
}

async function loadStudentSteps(me: Profile): Promise<Step[]> {
  const projects = await listProjects()
  // A student only sees their own project.
  const project = projects[0] ?? null

  const [settings, requests, versions, invitations, lastMessages, defenses, slots] =
    await Promise.all([
      getSettings(),
      listRequests(),
      project ? listVersions(project.id) : [],
      listInvitations(),
      listLastMessages(),
      listDefenses(),
      listSlots(),
    ])
  return studentSteps({
    me,
    project,
    settings,
    requests,
    versions,
    invitations,
    lastMessages,
    defenses,
    slots,
  })
}

async function loadProfessorData(me: Profile): Promise<ProfessorData> {
  const [themes, requests, invitations, projects, lastMessages, slots, availableSlots] =
    await Promise.all([
      listThemes(),
      listRequests(),
      listInvitations(),
      listProjects(),
      listLastMessages(),
      listSlots(),
      listAvailableSlots(me.id),
    ])
  return { me, themes, requests, invitations, projects, lastMessages, slots, availableSlots }
}
