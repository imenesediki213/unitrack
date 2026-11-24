import type { Problem, Project, Slot } from './types'

/**
 * What the search needs to know about a partial schedule. Rooms are only counted:
 * they are interchangeable, so trying each of them would repeat the same failures.
 */
export interface ScheduleState {
  /** Project id -> slot. */
  assigned: Map<string, Slot>
  /** Slot id -> number of rooms used. */
  roomsUsed: Map<string, number>
  /** "person|slot" for every duty. */
  busy: Set<string>
  /** "person|day" -> number of defenses. */
  dayLoad: Map<string, number>
}

/** A state that contains only the fixed defenses. */
export function initialState(problem: Problem): ScheduleState {
  const state: ScheduleState = {
    assigned: new Map(),
    roomsUsed: new Map(),
    busy: new Set(),
    dayLoad: new Map(),
  }

  for (const placement of problem.fixed) {
    const project = problem.projects.find((p) => p.id === placement.projectId)
    const slot = problem.slots.find((s) => s.id === placement.slotId)
    if (project && slot) place(state, project, slot)
  }
  return state
}

/** Availability is not checked here: candidate slots are filtered before the search. */
export function canPlace(state: ScheduleState, problem: Problem, project: Project, slot: Slot) {
  if (count(state.roomsUsed, slot.id) >= problem.roomIds.length) return false

  return project.people.every(
    (person) =>
      !state.busy.has(`${person}|${slot.id}`) &&
      count(state.dayLoad, `${person}|${slot.day}`) < problem.maxPerDay,
  )
}

export function place(state: ScheduleState, project: Project, slot: Slot) {
  state.assigned.set(project.id, slot)
  add(state.roomsUsed, slot.id, 1)
  for (const person of project.people) {
    state.busy.add(`${person}|${slot.id}`)
    add(state.dayLoad, `${person}|${slot.day}`, 1)
  }
}

/** Reverses `place`. */
export function undo(state: ScheduleState, project: Project, slot: Slot) {
  state.assigned.delete(project.id)
  add(state.roomsUsed, slot.id, -1)
  for (const person of project.people) {
    state.busy.delete(`${person}|${slot.id}`)
    add(state.dayLoad, `${person}|${slot.day}`, -1)
  }
}

export function count(counter: Map<string, number>, key: string) {
  return counter.get(key) ?? 0
}

function add(counter: Map<string, number>, key: string, amount: number) {
  counter.set(key, count(counter, key) + amount)
}
