import type { Conflict, Placement, Problem } from './types'

/** Lists every hard constraint that a schedule breaks. */
export function findConflicts(problem: Problem, placements: Placement[]): Conflict[] {
  const conflicts = [
    ...findRoomConflicts(placements),
    ...findPersonConflicts(problem, placements),
    ...findIncompleteJuries(problem, placements),
  ]

  // Past defenses cannot be moved, so a conflict only between them is not actionable.
  const fixedIds = new Set(problem.fixed.map((placement) => placement.projectId))
  return conflicts.filter((conflict) => conflict.projectIds.some((id) => !fixedIds.has(id)))
}

function findRoomConflicts(placements: Placement[]): Conflict[] {
  return groupBy(placements, (p) => `${p.slotId}|${p.roomId}`)
    .filter((group) => group.length > 1)
    .map((group) => ({
      type: 'roomDoubleBooked',
      roomId: group[0]!.roomId,
      slotId: group[0]!.slotId,
      projectIds: group.map((p) => p.projectId),
    }))
}

function findPersonConflicts(problem: Problem, placements: Placement[]): Conflict[] {
  const dayOfSlot = new Map(problem.slots.map((slot) => [slot.id, slot.day]))
  const conflicts: Conflict[] = []

  for (const [personId, duties] of dutiesByPerson(problem, placements)) {
    for (const duty of duties) {
      if (!problem.availability.get(personId)?.has(duty.slotId)) {
        conflicts.push({
          type: 'personUnavailable',
          personId,
          slotId: duty.slotId,
          projectIds: [duty.projectId],
        })
      }
    }

    for (const group of groupBy(duties, (duty) => duty.slotId)) {
      if (group.length > 1) {
        conflicts.push({
          type: 'personDoubleBooked',
          personId,
          slotId: group[0]!.slotId,
          projectIds: group.map((duty) => duty.projectId),
        })
      }
    }

    for (const group of groupBy(duties, (duty) => dayOfSlot.get(duty.slotId) ?? '')) {
      if (group.length > problem.maxPerDay) {
        conflicts.push({
          type: 'dayLimitExceeded',
          personId,
          day: dayOfSlot.get(group[0]!.slotId) ?? '',
          max: problem.maxPerDay,
          projectIds: group.map((duty) => duty.projectId),
        })
      }
    }
  }

  return conflicts
}

function findIncompleteJuries(problem: Problem, placements: Placement[]): Conflict[] {
  const placedIds = new Set(placements.map((p) => p.projectId))

  return problem.projects
    .filter((project) => placedIds.has(project.id) && !project.hasCompleteJury)
    .map((project) => ({ type: 'incompleteJury', projectIds: [project.id] }))
}

function dutiesByPerson(problem: Problem, placements: Placement[]): Map<string, Placement[]> {
  const projectsById = new Map(problem.projects.map((project) => [project.id, project]))
  const duties = new Map<string, Placement[]>()

  for (const placement of placements) {
    for (const personId of projectsById.get(placement.projectId)?.people ?? []) {
      duties.set(personId, [...(duties.get(personId) ?? []), placement])
    }
  }
  return duties
}

function groupBy<T>(items: T[], keyOf: (item: T) => string): T[][] {
  return [...Map.groupBy(items, keyOf).values()]
}
