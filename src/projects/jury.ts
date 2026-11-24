import type { JuryMember } from '../lib/types'

/** The supervisor always attends, so a complete jury needs a president and an examiner. */
export function isJuryComplete(jury: JuryMember[]): boolean {
  return (
    jury.some((member) => member.role === 'president') &&
    jury.some((member) => member.role === 'examiner')
  )
}
