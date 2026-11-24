import { expect, it } from 'vitest'
import type { InvitationStatus, JuryInvitation, JuryRole, Project } from '../lib/types'
import { professorsToInvite, rolesToInvite } from './rules'

const person = (id: string) => ({ id, full_name: id })

const project: Project = {
  id: 'project',
  title: '',
  status: 'in_progress',
  supervisor: person('supervisor'),
  students: [],
  jury: [{ role: 'examiner', person: person('member') }],
  description: null,
}

function invitation(id: string, status: InvitationStatus, jury_role: JuryRole): JuryInvitation {
  return { id, project_id: project.id, status, jury_role, reply: null, professor: person(id) }
}

it('offers the presidency until someone is invited to it', () => {
  expect(rolesToInvite(project, [])).toContain('president')
  expect(rolesToInvite(project, [invitation('a', 'pending', 'president')])).toEqual(['examiner'])
  expect(rolesToInvite(project, [invitation('a', 'refused', 'president')])).toContain('president')
})

it('does not offer the presidency when the jury has a president', () => {
  const complete = { ...project, jury: [{ role: 'president' as const, person: person('a') }] }
  expect(rolesToInvite(complete, [])).toEqual(['examiner'])
})

it('offers professors who are not involved and did not refuse', () => {
  const professors = ['supervisor', 'member', 'refused', 'cancelled', 'free'].map(person)
  const invitations = [
    invitation('refused', 'refused', 'examiner'),
    invitation('cancelled', 'cancelled', 'examiner'),
  ]

  expect(professorsToInvite(professors, project, invitations)).toEqual(
    ['cancelled', 'free'].map(person),
  )
})
