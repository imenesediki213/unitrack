import type { Placement, Problem } from './types'

interface Description {
  /** Day -> slot ids. */
  days: Record<string, string[]>
  /** Project id -> people. */
  projects: Record<string, string[]>
  /** Person id -> slot ids. People left out are always available. */
  availability?: Record<string, string[]>
  rooms?: number
  maxPerDay?: number
  fixed?: Placement[]
}

/** Builds a problem from a short description, to keep the tests readable. */
export function describeProblem(description: Description): Problem {
  const slots = Object.entries(description.days).flatMap(([day, ids]) =>
    ids.map((id) => ({ id, day })),
  )
  const projects = Object.entries(description.projects).map(([id, people]) => ({
    id,
    people,
    hasCompleteJury: true,
  }))
  const everySlot = slots.map((slot) => slot.id)
  const people = new Set(projects.flatMap((project) => project.people))

  return {
    projects,
    slots,
    roomIds: Array.from({ length: description.rooms ?? 1 }, (_, index) => `room${index + 1}`),
    availability: new Map(
      [...people].map((person) => [
        person,
        new Set(description.availability?.[person] ?? everySlot),
      ]),
    ),
    maxPerDay: description.maxPerDay ?? 10,
    fixed: description.fixed ?? [],
  }
}
