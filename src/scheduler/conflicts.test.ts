import { describe, expect, it } from 'vitest'
import { findConflicts } from './conflicts'
import { describeProblem } from './testProblems'

const days = { mon: ['m1', 'm2', 'm3'], tue: ['t1'] }

describe('findConflicts', () => {
  it('accepts a valid schedule', () => {
    const problem = describeProblem({ days, projects: { p1: ['ana'], p2: ['ana'] } })
    const placements = [
      { projectId: 'p1', slotId: 'm1', roomId: 'room1' },
      { projectId: 'p2', slotId: 'm2', roomId: 'room1' },
    ]
    expect(findConflicts(problem, placements)).toEqual([])
  })

  it('reports a room used twice', () => {
    const problem = describeProblem({ days, projects: { p1: ['ana'], p2: ['bob'] } })
    const placements = [
      { projectId: 'p1', slotId: 'm1', roomId: 'room1' },
      { projectId: 'p2', slotId: 'm1', roomId: 'room1' },
    ]
    expect(findConflicts(problem, placements)).toEqual([
      { type: 'roomDoubleBooked', roomId: 'room1', slotId: 'm1', projectIds: ['p1', 'p2'] },
    ])
  })

  it('reports a person in two rooms at once', () => {
    const problem = describeProblem({ days, rooms: 2, projects: { p1: ['ana'], p2: ['ana'] } })
    const placements = [
      { projectId: 'p1', slotId: 'm1', roomId: 'room1' },
      { projectId: 'p2', slotId: 'm1', roomId: 'room2' },
    ]
    expect(findConflicts(problem, placements)).toEqual([
      { type: 'personDoubleBooked', personId: 'ana', slotId: 'm1', projectIds: ['p1', 'p2'] },
    ])
  })

  it('reports an unavailable person', () => {
    const problem = describeProblem({
      days,
      projects: { p1: ['ana', 'bob'] },
      availability: { bob: ['m2'] },
    })
    const placements = [{ projectId: 'p1', slotId: 'm1', roomId: 'room1' }]
    expect(findConflicts(problem, placements)).toEqual([
      { type: 'personUnavailable', personId: 'bob', slotId: 'm1', projectIds: ['p1'] },
    ])
  })

  it('counts the daily maximum separately for each day', () => {
    const problem = describeProblem({
      days,
      maxPerDay: 2,
      projects: { p1: ['ana'], p2: ['ana'], p3: ['ana'] },
    })
    const onMonday = ['m1', 'm2', 'm3'].map((slotId, index) => ({
      projectId: `p${index + 1}`,
      slotId,
      roomId: 'room1',
    }))
    expect(findConflicts(problem, onMonday)).toEqual([
      {
        type: 'dayLimitExceeded',
        personId: 'ana',
        day: 'mon',
        max: 2,
        projectIds: ['p1', 'p2', 'p3'],
      },
    ])

    const overTwoDays = [...onMonday.slice(0, 2), { projectId: 'p3', slotId: 't1', roomId: 'room1' }]
    expect(findConflicts(problem, overTwoDays)).toEqual([])
  })

  it('reports a placed project whose jury is incomplete', () => {
    const problem = describeProblem({ days, projects: { p1: ['ana'] } })
    problem.projects[0]!.hasCompleteJury = false
    const placements = [{ projectId: 'p1', slotId: 'm1', roomId: 'room1' }]
    expect(findConflicts(problem, placements)).toEqual([
      { type: 'incompleteJury', projectIds: ['p1'] },
    ])
  })

  it('ignores conflicts that only involve past defenses', () => {
    const fixed = [{ projectId: 'p1', slotId: 'm1', roomId: 'room1' }]
    const problem = describeProblem({
      days,
      projects: { p1: ['ana'] },
      availability: { ana: [] },
      fixed,
    })
    expect(findConflicts(problem, fixed)).toEqual([])
  })
})
