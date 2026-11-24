import type { JuryInvitation, JuryRole, Person, Project } from '../lib/types'

// These only decide what to offer. The database applies the same rules for real.

/** Invitations that can still lead to a seat. */
export function isOpen(invitation: JuryInvitation): boolean {
  return invitation.status === 'pending' || invitation.status === 'accepted'
}

/** A jury has one president. */
export function rolesToInvite(project: Project, invitations: JuryInvitation[]): JuryRole[] {
  const hasPresident =
    project.jury.some((member) => member.role === 'president') ||
    invitations.some((item) => isOpen(item) && item.jury_role === 'president')
  return hasPresident ? ['examiner'] : ['president', 'examiner']
}

/** A refusal is final, but a cancelled invitation can be sent again. */
export function professorsToInvite(
  professors: Person[],
  project: Project,
  invitations: JuryInvitation[],
): Person[] {
  const excluded = new Set([
    project.supervisor.id,
    ...project.jury.map(({ person }) => person.id),
    ...invitations
      .filter((item) => item.status !== 'cancelled')
      .map(({ professor }) => professor.id),
  ])
  return professors.filter((professor) => !excluded.has(professor.id))
}
