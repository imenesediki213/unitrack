export interface Slot {
  id: string
  /** ISO date, for example "2027-06-15" */
  day: string
}

export interface Project {
  id: string
  /** The supervisor and the jury members: everyone who must attend. */
  people: string[]
  hasCompleteJury: boolean
}

export interface Placement {
  projectId: string
  slotId: string
  roomId: string
}

export interface Problem {
  /** Projects to schedule, plus the ones in `fixed`. */
  projects: Project[]
  /** In chronological order. */
  slots: Slot[]
  roomIds: string[]
  /** Person id -> ids of the slots when that person is available. */
  availability: Map<string, Set<string>>
  maxPerDay: number
  /** Defenses that already took place and must not move. */
  fixed: Placement[]
}

export type Conflict =
  | { type: 'roomDoubleBooked'; roomId: string; slotId: string; projectIds: string[] }
  | { type: 'personDoubleBooked'; personId: string; slotId: string; projectIds: string[] }
  | { type: 'personUnavailable'; personId: string; slotId: string; projectIds: string[] }
  | { type: 'dayLimitExceeded'; personId: string; day: string; max: number; projectIds: string[] }
  | { type: 'incompleteJury'; projectIds: string[] }

export type SolveResult =
  | { status: 'solved'; placements: Placement[] }
  /** Every possibility was tried: no valid schedule exists. */
  | { status: 'impossible' }
  /** The step limit was reached, which proves nothing. */
  | { status: 'gaveUp'; best: Placement[] }

export type Failure =
  | { type: 'noRooms' }
  | { type: 'noSlots' }
  | { type: 'incompleteJury'; projectId: string }
  | { type: 'noCommonSlot'; projectId: string; blockers: string[] }
  | { type: 'notEnoughCapacity'; needed: number; possible: number }
  | { type: 'personOverloaded'; personId: string; needed: number; possible: number }
  | { type: 'dayOverloaded'; personId: string; day: string; needed: number; possible: number }
  | { type: 'conflictGroup'; projectIds: string[]; relaxations: Relaxation[] }

/** A single change that makes a conflicting group schedulable. */
export type Relaxation =
  | { type: 'addRoom' }
  | { type: 'raiseDayLimit'; max: number }
  | { type: 'freePerson'; personId: string; day: string }

export interface Workload {
  personId: string
  needed: number
  possible: number
}

export type GenerateResult =
  | { status: 'solved'; placements: Placement[] }
  | { status: 'impossible'; failures: Failure[] }
  | { status: 'gaveUp'; best: Placement[]; busiest: Workload[] }
