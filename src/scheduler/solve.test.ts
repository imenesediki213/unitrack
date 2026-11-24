import { describe, expect, it } from 'vitest'
import { findConflicts } from './conflicts'
import { solve } from './solve'
import { describeProblem } from './testProblems'
import type { Placement, Problem } from './types'

function solvedPlacements(problem: Problem): Placement[] {
  const result = solve(problem)
  if (result.status !== 'solved') throw new Error(`Expected a solution, got "${result.status}"`)
  return result.placements
}

describe('solve', () => {
  it('returns an empty schedule when there is nothing to place', () => {
    expect(solve(describeProblem({ days: {}, projects: {} }))).toEqual({
      status: 'solved',
      placements: [],
    })
  })

  it('separates two projects that share a person', () => {
    const problem = describeProblem({
      days: { mon: ['m1', 'm2'] },
      rooms: 2,
      projects: { p1: ['ana'], p2: ['ana'] },
    })
    const placements = solvedPlacements(problem)
    expect(new Set(placements.map((p) => p.slotId)).size).toBe(2)
  })

  it('uses several rooms in the same slot', () => {
    const problem = describeProblem({
      days: { mon: ['m1'] },
      rooms: 2,
      projects: { p1: ['ana'], p2: ['bob'] },
    })
    expect(new Set(solvedPlacements(problem).map((p) => p.roomId)).size).toBe(2)
  })

  it('places a project on the only slot its jury shares', () => {
    const problem = describeProblem({
      days: { mon: ['m1', 'm2', 'm3'] },
      projects: { p1: ['ana', 'bob'] },
      availability: { ana: ['m1', 'm2'], bob: ['m2', 'm3'] },
    })
    expect(solvedPlacements(problem)).toMatchObject([{ projectId: 'p1', slotId: 'm2' }])
  })

  it('backtracks when the first choices lead to a dead end', () => {
    // Each project has two legal slots, so MRV cannot decide and the first choice is wrong.
    const problem = describeProblem({
      days: { mon: ['m1', 'm2', 'm3'] },
      projects: { p1: ['ana'], p2: ['bob'], p3: ['cat'] },
      availability: { ana: ['m1', 'm2'], bob: ['m1', 'm3'], cat: ['m1', 'm3'] },
    })
    const placements = solvedPlacements(problem)
    expect(findConflicts(problem, placements)).toEqual([])
    expect(placements).toHaveLength(3)
  })

  it('keeps past defenses in place and works around them', () => {
    const fixed = [{ projectId: 'done', slotId: 'm1', roomId: 'room1' }]
    const problem = describeProblem({
      days: { mon: ['m1', 'm2'] },
      projects: { done: ['ana'], p1: ['bob'] },
      fixed,
    })
    expect(solvedPlacements(problem)).toEqual([
      { projectId: 'p1', slotId: 'm2', roomId: 'room1' },
    ])
  })

  it('counts past defenses in the daily maximum', () => {
    const problem = describeProblem({
      days: { mon: ['m1', 'm2'], tue: ['t1'] },
      maxPerDay: 1,
      projects: { done: ['ana'], p1: ['ana'] },
      fixed: [{ projectId: 'done', slotId: 'm1', roomId: 'room1' }],
    })
    expect(solvedPlacements(problem)).toMatchObject([{ slotId: 't1' }])
  })

  it('proves that a schedule is impossible', () => {
    const problem = describeProblem({
      days: { mon: ['m1'] },
      rooms: 2,
      projects: { p1: ['ana'], p2: ['ana'] },
    })
    expect(solve(problem)).toEqual({ status: 'impossible' })
  })

  it('gives up at the step limit instead of claiming that it is impossible', () => {
    const problem = describeProblem({
      days: { mon: ['m1', 'm2', 'm3'] },
      projects: { p1: ['ana'], p2: ['bob'], p3: ['cat'] },
    })
    const result = solve(problem, 2)
    expect(result.status).toBe('gaveUp')
    expect(result).toMatchObject({ best: [{ projectId: 'p1' }, { projectId: 'p2' }] })
  })

  it('agrees with brute force on 300 small random problems', () => {
    const random = createRandom(42)
    const outcomes = { solved: 0, impossible: 0 }

    for (let round = 0; round < 300; round += 1) {
      const problem = randomProblem(random)
      const result = solve(problem)

      if (result.status === 'solved') {
        outcomes.solved += 1
        expect(result.placements).toHaveLength(problem.projects.length)
        expect(findConflicts(problem, result.placements)).toEqual([])
      } else {
        outcomes.impossible += 1
        expect(result.status).toBe('impossible')
        expect(existsByBruteForce(problem)).toBe(false)
      }
    }

    // The comparison is only meaningful if both outcomes are common.
    expect(outcomes.solved).toBeGreaterThan(50)
    expect(outcomes.impossible).toBeGreaterThan(50)
  })
})

/** Tries every slot and room for every project, with no heuristic at all. */
function existsByBruteForce(problem: Problem, placements: Placement[] = []): boolean {
  const project = problem.projects[placements.length]
  if (!project) return findConflicts(problem, placements).length === 0

  return problem.slots.some((slot) =>
    problem.roomIds.some((roomId) =>
      existsByBruteForce(problem, [
        ...placements,
        { projectId: project.id, slotId: slot.id, roomId },
      ]),
    ),
  )
}

function randomProblem(random: () => number): Problem {
  const people = ['ana', 'bob', 'cat', 'dan']
  const slots = ['m1', 'm2', 't1', 't2']

  return describeProblem({
    days: { mon: ['m1', 'm2'], tue: ['t1', 't2'] },
    rooms: random() < 0.5 ? 1 : 2,
    maxPerDay: random() < 0.5 ? 1 : 2,
    projects: {
      p1: pickSome(people, random),
      p2: pickSome(people, random),
      p3: pickSome(people, random),
    },
    availability: Object.fromEntries(
      people.map((person) => [person, slots.filter(() => random() < 0.8)]),
    ),
  })
}

function pickSome(people: string[], random: () => number): string[] {
  return people.filter(() => random() < 0.5)
}

/** A seeded generator (mulberry32), so that a failing case can be reproduced. */
function createRandom(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}
