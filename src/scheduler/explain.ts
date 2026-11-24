import { candidateSlots, projectsToPlace, solve } from './solve'
import { canPlace, count, initialState } from './state'
import type { Failure, Problem, Project, Relaxation, Workload } from './types'

const GROUP_STEP_LIMIT = 2_000

/**
 * Looks for reasons that make a schedule impossible without searching for one.
 * Each is a proof, but an empty list does not mean that a schedule exists.
 */
export function checkBeforeSearch(problem: Problem): Failure[] {
  const projects = projectsToPlace(problem)
  if (projects.length === 0) return []

  const setup: Failure[] = []
  if (problem.roomIds.length === 0) setup.push({ type: 'noRooms' })
  if (problem.slots.length === 0) setup.push({ type: 'noSlots' })
  if (setup.length > 0) return setup

  return [
    ...checkJuries(problem, projects),
    ...checkCapacity(problem, projects),
    ...checkPeople(problem, projects),
  ]
}

function checkJuries(problem: Problem, projects: Project[]): Failure[] {
  const candidates = candidateSlots(problem)
  const failures: Failure[] = []

  for (const project of projects) {
    if (!project.hasCompleteJury) {
      failures.push({ type: 'incompleteJury', projectId: project.id })
    } else if (candidates.get(project.id)!.length === 0) {
      const blockers = findBlockers(problem, project)
      failures.push({ type: 'noCommonSlot', projectId: project.id, blockers })
    }
  }
  return failures
}

/** The people without whom the others share a slot. Empty when no single person is the cause. */
function findBlockers(problem: Problem, project: Project): string[] {
  return project.people.filter((blocker) => {
    const others = project.people.filter((person) => person !== blocker)
    return problem.slots.some((slot) =>
      others.every((person) => problem.availability.get(person)?.has(slot.id)),
    )
  })
}

function checkCapacity(problem: Problem, projects: Project[]): Failure[] {
  const possible = problem.roomIds.length * problem.slots.length - problem.fixed.length
  if (projects.length <= possible) return []
  return [{ type: 'notEnoughCapacity', needed: projects.length, possible }]
}

function checkPeople(problem: Problem, projects: Project[]): Failure[] {
  const candidates = candidateSlots(problem)
  const failures: Failure[] = []

  for (const { personId, needed, possible } of workloads(problem)) {
    if (needed > possible) {
      failures.push({ type: 'personOverloaded', personId, needed, possible })
      continue
    }

    const ownProjects = projects.filter((project) => project.people.includes(personId))
    for (const day of daysOf(problem)) {
      const forced = ownProjects.filter((project) => {
        const slots = candidates.get(project.id)!
        return slots.length > 0 && slots.every((slot) => slot.day === day)
      })
      const possibleThatDay = dayCapacity(problem, personId, day)
      if (forced.length > possibleThatDay) {
        failures.push({
          type: 'dayOverloaded',
          personId,
          day,
          needed: forced.length,
          possible: possibleThatDay,
        })
      }
    }
  }
  return failures
}

/** For each person, the defenses still to place and the most they can attend. */
export function workloads(problem: Problem): Workload[] {
  const needed = new Map<string, number>()
  for (const project of projectsToPlace(problem)) {
    for (const personId of project.people) {
      needed.set(personId, count(needed, personId) + 1)
    }
  }

  return [...needed].map(([personId, total]) => ({
    personId,
    needed: total,
    possible: daysOf(problem).reduce((sum, day) => sum + dayCapacity(problem, personId, day), 0),
  }))
}

/** The most defenses a person can attend on a day, given the fixed ones. */
function dayCapacity(problem: Problem, personId: string, day: string): number {
  const state = initialState(problem)
  const alone: Project = { id: '', people: [personId], hasCompleteJury: true }
  const freeSlots = problem.slots.filter(
    (slot) =>
      slot.day === day &&
      problem.availability.get(personId)?.has(slot.id) &&
      canPlace(state, problem, alone, slot),
  )
  const remainingToday = problem.maxPerDay - count(state.dayLoad, `${personId}|${day}`)
  return Math.max(0, Math.min(freeSlots.length, remainingToday))
}

function daysOf(problem: Problem): string[] {
  return [...new Set(problem.slots.map((slot) => slot.day))]
}

/**
 * Call it on a problem that `solve` proved impossible. Tries to remove each project and keeps
 * the removal only when the rest is still proven impossible, so what is left always is too.
 */
export function findConflictGroup(problem: Problem): string[] {
  let group = projectsToPlace(problem).map((project) => project.id)

  for (const id of group) {
    const without = group.filter((other) => other !== id)
    if (solve(restrictTo(problem, without), GROUP_STEP_LIMIT).status === 'impossible') {
      group = without
    }
  }
  return group
}

/** Changes one constraint at a time and reports the changes that make the group schedulable. */
export function findRelaxations(problem: Problem, group: string[]): Relaxation[] {
  const small = restrictTo(problem, group)
  const relaxations: Relaxation[] = []
  const works = (relaxed: Problem) => solve(relaxed, GROUP_STEP_LIMIT).status === 'solved'

  if (works({ ...small, roomIds: [...small.roomIds, 'extra-room'] })) {
    relaxations.push({ type: 'addRoom' })
  }

  const max = small.maxPerDay + 1
  if (works({ ...small, maxPerDay: max })) {
    relaxations.push({ type: 'raiseDayLimit', max })
  }

  const people = new Set(projectsToPlace(small).flatMap((project) => project.people))
  for (const personId of people) {
    const day = daysOf(small).find((d) => works(withPersonFree(small, personId, d)))
    if (day) relaxations.push({ type: 'freePerson', personId, day })
  }
  return relaxations
}

function restrictTo(problem: Problem, projectIds: string[]): Problem {
  const kept = new Set([...projectIds, ...problem.fixed.map((p) => p.projectId)])
  return { ...problem, projects: problem.projects.filter((project) => kept.has(project.id)) }
}

function withPersonFree(problem: Problem, personId: string, day: string): Problem {
  const slots = new Set(problem.availability.get(personId))
  for (const slot of problem.slots) {
    if (slot.day === day) slots.add(slot.id)
  }
  return { ...problem, availability: new Map(problem.availability).set(personId, slots) }
}
