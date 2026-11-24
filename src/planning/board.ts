import type { Defense, Project, Room, Settings, TimeSlot } from '../lib/types'
import { isJuryComplete } from '../projects/jury'
import { findConflicts, type Placement, type Problem } from '../scheduler'

export interface PlanningData {
  projects: Project[]
  rooms: Room[]
  /** In chronological order. */
  slots: TimeSlot[]
  availability: Map<string, Set<string>>
  defenses: Defense[]
  settings: Settings
}

export interface Cell {
  slotId: string
  roomId: string
}

/** Translates the data of the app into the problem that the scheduler understands. */
export function buildProblem(data: PlanningData): Problem {
  const schedulable = data.projects.filter(
    (project) => project.status === 'approved' || project.status === 'defended',
  )
  const defendedIds = new Set(
    schedulable.filter((project) => project.status === 'defended').map((project) => project.id),
  )

  return {
    projects: schedulable.map((project) => ({
      id: project.id,
      people: [project.supervisor.id, ...project.jury.map(({ person }) => person.id)],
      hasCompleteJury: isJuryComplete(project.jury),
    })),
    slots: data.slots.map(({ id, day }) => ({ id, day })),
    roomIds: data.rooms.map((room) => room.id),
    availability: data.availability,
    maxPerDay: data.settings.max_defenses_per_day,
    fixed: data.defenses.map(toPlacement).filter((p) => defendedIds.has(p.projectId)),
  }
}

/** The saved defenses that can still move. */
export function movablePlacements(data: PlanningData, problem: Problem): Placement[] {
  const fixedIds = new Set(problem.fixed.map((p) => p.projectId))
  return data.defenses.map(toPlacement).filter((p) => !fixedIds.has(p.projectId))
}

function toPlacement(defense: Defense): Placement {
  return { projectId: defense.project_id, slotId: defense.slot_id, roomId: defense.room_id }
}

/**
 * Moves a project to a cell. If another project is there, the two swap places, so a cell
 * never holds two. A project that comes from the waiting list sends the other one back to it.
 */
export function moveProject(placements: Placement[], projectId: string, target: Cell): Placement[] {
  const source = placements.find((p) => p.projectId === projectId)
  const occupant = placements.find((p) => isAt(p, target) && p.projectId !== projectId)

  const result = placements.filter((p) => p !== source && p !== occupant)
  result.push({ projectId, ...target })
  if (occupant && source) {
    result.push({ projectId: occupant.projectId, slotId: source.slotId, roomId: source.roomId })
  }
  return result
}

export function removeProject(placements: Placement[], projectId: string): Placement[] {
  return placements.filter((p) => p.projectId !== projectId)
}

/** Keys of the cells where the project itself would be in conflict. */
export function conflictingCells(
  problem: Problem,
  placements: Placement[],
  projectId: string,
): Set<string> {
  const cells = new Set<string>()

  for (const slot of problem.slots) {
    for (const roomId of problem.roomIds) {
      const target = { slotId: slot.id, roomId }
      const moved = [...problem.fixed, ...moveProject(placements, projectId, target)]
      const conflicts = findConflicts(problem, moved)
      if (conflicts.some((conflict) => conflict.projectIds.includes(projectId))) {
        cells.add(cellKey(target))
      }
    }
  }
  return cells
}

export function isAt(placement: Placement, cell: Cell): boolean {
  return placement.slotId === cell.slotId && placement.roomId === cell.roomId
}

export function cellKey({ slotId, roomId }: Cell): string {
  return `${slotId}|${roomId}`
}

export function isSameSchedule(a: Placement[], b: Placement[]): boolean {
  const keys = new Set(a.map((p) => `${p.projectId}|${cellKey(p)}`))
  return a.length === b.length && b.every((p) => keys.has(`${p.projectId}|${cellKey(p)}`))
}
