import { expect, it } from 'vitest'
import type { Profile, RequestStatus, Role, Theme, ThemeRequest, ThemeStatus } from '../lib/types'
import { canAsk, canEdit, canRemove, canReview } from './rules'

function person(id: string, role: Role): Profile {
  return { id, full_name: id, role }
}

const admin = person('admin', 'admin')
const professor = person('professor', 'supervisor')
const colleague = person('colleague', 'supervisor')
const student = person('student', 'student')

function theme(status: ThemeStatus, proposedBy: string | null = null): Theme {
  return {
    id: 'theme',
    title: '',
    description: '',
    capacity: 1,
    status,
    refusal_reason: null,
    proposed_by: proposedBy,
    proposer: null,
    professor,
  }
}

it('lets the professor review an idea, then the admin', () => {
  const people = [admin, professor, colleague, student]
  const reviewers = (status: ThemeStatus) =>
    people.filter((me) => canReview(theme(status, student.id), me))

  expect(reviewers('proposed')).toEqual([professor])
  expect(reviewers('pending')).toEqual([admin])
  expect(reviewers('open')).toEqual([])
})

it('offers open themes that the student did not ask for yet', () => {
  const requests = (status: RequestStatus): ThemeRequest[] => [
    { id: '', status, message: null, reply: null, student, theme: theme('open') },
  ]

  expect(canAsk(theme('open'), [])).toBe(true)
  expect(canAsk(theme('taken'), [])).toBe(false)
  expect(canAsk(theme('open'), requests('refused'))).toBe(false)
  expect(canAsk(theme('open'), requests('cancelled'))).toBe(true)
})

it('lets only the professor edit, and only before the approval', () => {
  expect(canEdit(theme('refused'), professor)).toBe(true)
  expect(canEdit(theme('open'), professor)).toBe(false)
  expect(canEdit(theme('pending'), colleague)).toBe(false)
})

it('lets authors withdraw their themes, but not an idea that was accepted', () => {
  expect(canRemove(theme('open'), professor)).toBe(true)
  expect(canRemove(theme('proposed', student.id), student)).toBe(true)
  expect(canRemove(theme('pending', student.id), student)).toBe(false)
  expect(canRemove(theme('pending', student.id), professor)).toBe(false)
  expect(canRemove(theme('open'), admin)).toBe(true)
})
