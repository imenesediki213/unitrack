import type { Profile, Theme, ThemeRequest } from '../lib/types'

// These only decide which buttons to show. The database applies the same rules for real.

/** A student's idea goes to the professor, then every theme goes to the admin. */
export function canReview(theme: Theme, me: Profile): boolean {
  if (theme.status === 'proposed') return theme.professor.id === me.id
  return theme.status === 'pending' && me.role === 'admin'
}

/** A refusal is final, but a cancelled request can be sent again. */
export function canAsk(theme: Theme, myRequests: ThemeRequest[]): boolean {
  const asked = myRequests.some(
    (request) => request.theme.id === theme.id && request.status !== 'cancelled',
  )
  return theme.status === 'open' && !asked
}

export function canEdit(theme: Theme, me: Profile): boolean {
  return theme.professor.id === me.id && (theme.status === 'pending' || theme.status === 'refused')
}

export function canRemove(theme: Theme, me: Profile): boolean {
  if (me.role === 'admin') return true
  if (theme.proposed_by === me.id) return theme.status === 'proposed' || theme.status === 'refused'
  return theme.professor.id === me.id && theme.proposed_by === null
}
