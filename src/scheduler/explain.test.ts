import { describe, expect, it } from 'vitest'
import { checkBeforeSearch, findConflictGroup } from './explain'
import { generateSchedule } from './index'
import { solve } from './solve'
import { describeProblem } from './testProblems'

describe('checkBeforeSearch', () => {
  it('finds nothing wrong with a feasible problem', () => {
    const problem = describeProblem({ days: { mon: ['m1'] }, projects: { p1: ['ana'] } })
    expect(checkBeforeSearch(problem)).toEqual([])
  })

  it('asks for rooms and slots first', () => {
    const problem = describeProblem({ days: {}, rooms: 0, projects: { p1: ['ana'] } })
    expect(checkBeforeSearch(problem)).toEqual([{ type: 'noRooms' }, { type: 'noSlots' }])
  })

  it('names a project whose jury is incomplete', () => {
    const problem = describeProblem({ days: { mon: ['m1'] }, projects: { p1: ['ana'] } })
    problem.projects[0]!.hasCompleteJury = false
    expect(checkBeforeSearch(problem)).toContainEqual({ type: 'incompleteJury', projectId: 'p1' })
  })

  it('names the person who prevents a jury from meeting', () => {
    const problem = describeProblem({
      days: { mon: ['m1', 'm2'] },
      projects: { p1: ['ana', 'bob', 'cat'] },
      availability: { ana: ['m1'], bob: ['m1'], cat: ['m2'] },
    })
    expect(checkBeforeSearch(problem)).toContainEqual({
      type: 'noCommonSlot',
      projectId: 'p1',
      blockers: ['cat'],
    })
  })

  it('names nobody when no single person is the cause', () => {
    const problem = describeProblem({
      days: { mon: ['m1', 'm2', 'm3'] },
      projects: { p1: ['ana', 'bob', 'cat'] },
      availability: { ana: ['m1'], bob: ['m2'], cat: ['m3'] },
    })
    expect(checkBeforeSearch(problem)).toContainEqual({
      type: 'noCommonSlot',
      projectId: 'p1',
      blockers: [],
    })
  })

  it('reports more projects than places, past defenses included', () => {
    const problem = describeProblem({
      days: { mon: ['m1', 'm2'] },
      projects: { done: ['ana'], p1: ['bob'], p2: ['cat'] },
      fixed: [{ projectId: 'done', slotId: 'm1', roomId: 'room1' }],
    })
    expect(checkBeforeSearch(problem)).toEqual([
      { type: 'notEnoughCapacity', needed: 2, possible: 1 },
    ])
  })

  it('reports a person with more defenses than they can attend', () => {
    const problem = describeProblem({
      days: { mon: ['m1', 'm2', 'm3'], tue: ['t1', 't2', 't3'] },
      maxPerDay: 2,
      projects: { p1: ['ana'], p2: ['ana'], p3: ['ana'], p4: ['ana'] },
      availability: { ana: ['m1', 'm2', 'm3', 't1'] },
    })
    expect(checkBeforeSearch(problem)).toEqual([
      { type: 'personOverloaded', personId: 'ana', needed: 4, possible: 3 },
    ])
  })

  it('reports a person whose projects are all forced onto the same day', () => {
    // Dr. X could do 2 on Tuesday and 2 on Monday, but the three co-jurors only come on Tuesday.
    const problem = describeProblem({
      days: { mon: ['m1', 'm2'], tue: ['t1', 't2', 't3'] },
      projects: { p1: ['x', 'ana'], p2: ['x', 'ana'], p3: ['x', 'ana'] },
      availability: { x: ['m1', 'm2', 't1', 't2'], ana: ['t1', 't2', 't3'] },
    })
    expect(checkBeforeSearch(problem)).toEqual([
      { type: 'dayOverloaded', personId: 'x', day: 'tue', needed: 3, possible: 2 },
    ])
  })
})

describe('conflict groups', () => {
  // Three projects need each other's people, and all their people share only two slots.
  // Everyone has enough room in their own calendar, so only the search can notice.
  const problem = describeProblem({
    days: { mon: ['m1', 'm2', 'm3'] },
    rooms: 3,
    projects: {
      p1: ['ana', 'bob'],
      p2: ['bob', 'cat'],
      p3: ['cat', 'ana'],
      unrelated: ['dan'],
    },
    availability: { ana: ['m1', 'm2'], bob: ['m1', 'm2'], cat: ['m1', 'm2'] },
  })

  it('isolates the projects that cannot fit together', () => {
    expect(checkBeforeSearch(problem)).toEqual([])
    expect(solve(problem).status).toBe('impossible')
    expect(findConflictGroup(problem)).toEqual(['p1', 'p2', 'p3'])
  })

  it('suggests only the changes that work', () => {
    const result = generateSchedule(problem)
    // Another room or a higher daily maximum would not help. One person alone would not
    // either, since every pair of projects shares someone else.
    expect(result).toEqual({
      status: 'impossible',
      failures: [{ type: 'conflictGroup', projectIds: ['p1', 'p2', 'p3'], relaxations: [] }],
    })
  })

  it('suggests a room when rooms are the problem', () => {
    const crowded = describeProblem({
      days: { mon: ['m1'], tue: ['t1'] },
      projects: { p1: ['ana'], p2: ['bob'] },
      availability: { ana: ['m1'], bob: ['m1'] },
    })
    expect(generateSchedule(crowded)).toEqual({
      status: 'impossible',
      failures: [
        {
          type: 'conflictGroup',
          projectIds: ['p1', 'p2'],
          relaxations: [
            { type: 'addRoom' },
            { type: 'freePerson', personId: 'ana', day: 'tue' },
            { type: 'freePerson', personId: 'bob', day: 'tue' },
          ],
        },
      ],
    })
  })
})

describe('generateSchedule', () => {
  it('returns the busiest people and a partial schedule when it gives up', () => {
    const problem = describeProblem({
      days: { mon: ['m1', 'm2', 'm3'] },
      projects: { p1: ['ana'], p2: ['ana'], p3: ['bob'] },
    })
    const result = generateSchedule(problem, 1)
    expect(result).toMatchObject({
      status: 'gaveUp',
      best: [{ projectId: 'p1' }],
      busiest: [{ personId: 'ana', needed: 2, possible: 3 }, { personId: 'bob' }],
    })
  })
})
