import { describe, expect, it } from 'vitest'
import type { JuryMember, Project, ProjectStatus } from '../lib/types'
import { en } from '../messages/en'
import { fr } from '../messages/fr'
import { findConflicts } from '../scheduler'
import {
  buildProblem,
  conflictingCells,
  isSameSchedule,
  movablePlacements,
  moveProject,
  removeProject,
  type PlanningData,
} from './board'
import { buildDaySlots, groupByDay } from './daySlots'
import { createExplainer } from './explanations'

const jury: JuryMember[] = [
  { role: 'president', person: { id: 'pres', full_name: 'Dr. Pres' } },
  { role: 'examiner', person: { id: 'exam', full_name: 'Dr. Exam' } },
]

function project(id: string, status: ProjectStatus, members = jury): Project {
  return {
    id,
    title: `Project ${id}`,
    status,
    supervisor: { id: 'sup', full_name: 'Dr. X' },
    students: [],
    jury: members,
  }
}

const data: PlanningData = {
  projects: [
    project('a', 'approved'),
    project('b', 'approved', []),
    project('done', 'defended'),
    project('early', 'in_progress'),
  ],
  rooms: [
    { id: 'r1', name: 'Room 1' },
    { id: 'r2', name: 'Room 2' },
  ],
  slots: [
    { id: 's1', day: '2027-06-15', start_time: '09:00:00', end_time: '10:00:00' },
    { id: 's2', day: '2027-06-15', start_time: '10:00:00', end_time: '11:00:00' },
  ],
  availability: new Map([
    ['sup', new Set(['s1', 's2'])],
    ['pres', new Set(['s1', 's2'])],
    ['exam', new Set(['s1'])],
  ]),
  defenses: [
    { project_id: 'done', slot_id: 's1', room_id: 'r1' },
    { project_id: 'a', slot_id: 's2', room_id: 'r1' },
  ],
  settings: { max_defenses_per_day: 3, schedule_published: false },
}

describe('buildProblem', () => {
  const problem = buildProblem(data)

  it('keeps approved and defended projects only', () => {
    expect(problem.projects.map((p) => p.id)).toEqual(['a', 'b', 'done'])
  })

  it('includes the supervisor among the people who must attend', () => {
    expect(problem.projects[0]!.people).toEqual(['sup', 'pres', 'exam'])
  })

  it('notices an incomplete jury', () => {
    expect(problem.projects.map((p) => p.hasCompleteJury)).toEqual([true, false, true])
  })

  it('separates past defenses from those that can move', () => {
    expect(problem.fixed.map((p) => p.projectId)).toEqual(['done'])
    expect(movablePlacements(data, problem).map((p) => p.projectId)).toEqual(['a'])
  })
})

describe('moveProject', () => {
  const a = { projectId: 'a', slotId: 's1', roomId: 'r1' }
  const b = { projectId: 'b', slotId: 's2', roomId: 'r1' }

  it('moves to an empty cell', () => {
    const moved = moveProject([a, b], 'a', { slotId: 's1', roomId: 'r2' })
    expect(isSameSchedule(moved, [{ ...a, roomId: 'r2' }, b])).toBe(true)
  })

  it('swaps two placed projects', () => {
    const moved = moveProject([a, b], 'a', { slotId: 's2', roomId: 'r1' })
    expect(isSameSchedule(moved, [{ ...a, slotId: 's2' }, { ...b, slotId: 's1' }])).toBe(true)
  })

  it('sends the occupant to the waiting list when the project comes from there', () => {
    const moved = moveProject([b], 'a', { slotId: 's2', roomId: 'r1' })
    expect(moved).toEqual([{ ...a, slotId: 's2' }])
  })

  it('changes nothing when dropped on its own cell', () => {
    const moved = moveProject([a, b], 'a', { slotId: 's1', roomId: 'r1' })
    expect(isSameSchedule(moved, [a, b])).toBe(true)
  })

  it('removes a project', () => {
    expect(removeProject([a, b], 'a')).toEqual([b])
  })
})

describe('conflictingCells', () => {
  it('marks the cells where the project would be in conflict', () => {
    const cells = conflictingCells(buildProblem(data), [], 'a')
    // At s1 its jury attends the past defense; at s2 the examiner is not available.
    expect([...cells].sort()).toEqual(['s1|r1', 's1|r2', 's2|r1', 's2|r2'])
  })
})

describe('explanations', () => {
  it('writes conflicts in plain language', () => {
    const problem = buildProblem(data)
    const conflicts = findConflicts(problem, [...problem.fixed, ...movablePlacements(data, problem)])
    expect(conflicts.map(createExplainer(data, en, 'en').conflict)).toEqual([
      'Dr. Exam is not available for “Project a”, Tuesday, June 15, 2027, 10:00.',
    ])
  })

  it('writes failures in plain language', () => {
    const explain = createExplainer(data, fr, 'fr')
    expect(
      explain.failure({
        type: 'dayOverloaded',
        personId: 'sup',
        day: '2027-06-15',
        needed: 3,
        possible: 2,
      }),
    ).toBe(
      'Dr. X a 3 soutenances qui ne peuvent avoir lieu que mardi 15 juin 2027, mais ne peut en assurer que 2 ce jour-là.',
    )
  })
})

describe('buildDaySlots', () => {
  it('cuts a period and drops what does not fit', () => {
    expect(buildDaySlots('2027-06-15', '09:00', '11:00', 45)).toEqual([
      { day: '2027-06-15', start_time: '09:00', end_time: '09:45' },
      { day: '2027-06-15', start_time: '09:45', end_time: '10:30' },
    ])
  })

  it('creates nothing from invalid input', () => {
    expect(buildDaySlots('', '09:00', '11:00', 60)).toEqual([])
    expect(buildDaySlots('2027-06-15', '11:00', '09:00', 60)).toEqual([])
    expect(buildDaySlots('2027-06-15', '09:00', '11:00', 0)).toEqual([])
    expect(buildDaySlots('2027-06-15', '09:00', '11:00', Number.NaN)).toEqual([])
  })

  it('groups slots by day', () => {
    expect(groupByDay(data.slots)).toEqual([['2027-06-15', data.slots]])
  })
})
