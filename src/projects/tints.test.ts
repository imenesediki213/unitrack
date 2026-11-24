import { expect, it } from 'vitest'
import type { Project } from '../lib/types'
import { supervisorTints } from './tints'

function projectOf(supervisorId: string): Project {
  const supervisor = { id: supervisorId, full_name: supervisorId }
  return { id: '', title: '', status: 'approved', supervisor, students: [], jury: [] }
}

it('gives each supervisor one colour, whatever the order of the projects', () => {
  const tints = supervisorTints(['b', 'a', 'b'].map(projectOf))
  expect(tints).toEqual(supervisorTints(['a', 'b'].map(projectOf)))
  expect(tints.get('a')).not.toBe(tints.get('b'))
})

it('uses the six colours again beyond six supervisors', () => {
  const tints = supervisorTints(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(projectOf))
  expect(tints.get('g')).toBe(tints.get('a'))
})
