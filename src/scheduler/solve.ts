import { canPlace, initialState, place, undo } from './state'
import type { Placement, Problem, Project, Slot, SolveResult } from './types'

const DEFAULT_STEP_LIMIT = 20_000

/**
 * Backtracking search. Each project is a variable whose domain is the slots when
 * all its people are available.
 */
export function solve(problem: Problem, stepLimit = DEFAULT_STEP_LIMIT): SolveResult {
  const state = initialState(problem)
  const candidates = candidateSlots(problem)
  let best = new Map<string, Slot>()
  let steps = 0

  function search(remaining: Project[]): 'solved' | 'impossible' | 'gaveUp' {
    if (remaining.length === 0) return 'solved'
    steps += 1
    if (steps > stepLimit) return 'gaveUp'

    const { project, slots } = mostConstrained(remaining)
    const others = remaining.filter((other) => other !== project)

    for (const slot of slots) {
      place(state, project, slot)
      if (state.assigned.size > best.size) best = new Map(state.assigned)

      const outcome = search(others)
      if (outcome !== 'impossible') return outcome
      undo(state, project, slot)
    }
    return 'impossible'
  }

  /**
   * MRV (minimum remaining values): picks the project with the fewest legal slots.
   * A project with none is picked at once, which makes the branch fail immediately.
   */
  function mostConstrained(remaining: Project[]) {
    let choice: { project: Project; slots: Slot[] } | undefined

    for (const project of remaining) {
      const slots = candidates
        .get(project.id)!
        .filter((slot) => canPlace(state, problem, project, slot))
      if (!choice || slots.length < choice.slots.length) choice = { project, slots }
      if (slots.length === 0) break
    }
    return choice!
  }

  const outcome = search(projectsToPlace(problem))

  if (outcome === 'solved') {
    return { status: 'solved', placements: assignRooms(problem, state.assigned) }
  }
  if (outcome === 'gaveUp') {
    return { status: 'gaveUp', best: assignRooms(problem, best) }
  }
  return { status: 'impossible' }
}

export function projectsToPlace(problem: Problem): Project[] {
  const fixedIds = new Set(problem.fixed.map((placement) => placement.projectId))
  return problem.projects.filter((project) => !fixedIds.has(project.id))
}

/** For each project, the slots when everyone is available. */
export function candidateSlots(problem: Problem): Map<string, Slot[]> {
  return new Map(
    problem.projects.map((project) => [
      project.id,
      problem.slots.filter((slot) =>
        project.people.every((person) => problem.availability.get(person)?.has(slot.id)),
      ),
    ]),
  )
}

/** The search never exceeds the number of rooms, so a free room always exists. */
function assignRooms(problem: Problem, assigned: Map<string, Slot>): Placement[] {
  const fixedIds = new Set(problem.fixed.map((placement) => placement.projectId))
  const taken = new Set(problem.fixed.map((p) => `${p.slotId}|${p.roomId}`))
  const placements: Placement[] = []

  for (const [projectId, slot] of assigned) {
    if (fixedIds.has(projectId)) continue
    const roomId = problem.roomIds.find((room) => !taken.has(`${slot.id}|${room}`))!
    taken.add(`${slot.id}|${roomId}`)
    placements.push({ projectId, slotId: slot.id, roomId })
  }
  return placements
}
