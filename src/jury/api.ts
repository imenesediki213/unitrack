import { supabase, unwrap } from '../lib/supabase'
import type { JuryInvitation, JuryLoad, JuryRole } from '../lib/types'

/** The database returns the invitations of the user's projects, and those they received. */
export function listInvitations(): Promise<JuryInvitation[]> {
  return unwrap(
    supabase
      .from('jury_invitations')
      .select('id, project_id, jury_role, status, reply, professor:profiles!professor_id(id, full_name)')
      .order('created_at'),
  )
}

export function inviteToJury(
  project_id: string,
  professor_id: string,
  jury_role: JuryRole,
): Promise<void> {
  return unwrap(supabase.from('jury_invitations').insert({ project_id, professor_id, jury_role }))
}

export function removeInvitation(id: string): Promise<void> {
  return unwrap(supabase.from('jury_invitations').delete().eq('id', id))
}

export function answerInvitation(
  id: string,
  accepted: boolean,
  reason: string | null,
): Promise<void> {
  return unwrap(supabase.rpc('answer_invitation', { invitation: id, accepted, reason }))
}

/** Moves the professors who accepted into the jury. For the admin. */
export function confirmJury(projectId: string): Promise<void> {
  return unwrap(supabase.rpc('confirm_jury', { project: projectId }))
}

/** How many juries each professor has. */
export function listJuryLoads(): Promise<JuryLoad[]> {
  return unwrap(supabase.rpc('jury_loads'))
}
