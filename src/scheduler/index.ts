import { checkBeforeSearch, findConflictGroup, findRelaxations, workloads } from './explain'
import { solve } from './solve'
import type { GenerateResult, Problem } from './types'

export { findConflicts } from './conflicts'
export type * from './types'

const BUSIEST_PEOPLE_SHOWN = 3

/** Builds a schedule, or explains why it could not. */
export function generateSchedule(problem: Problem, stepLimit?: number): GenerateResult {
  const failures = checkBeforeSearch(problem)
  if (failures.length > 0) return { status: 'impossible', failures }

  const result = solve(problem, stepLimit)
  if (result.status === 'solved') return result

  if (result.status === 'gaveUp') {
    const busiest = workloads(problem)
      .sort((a, b) => b.needed / b.possible - a.needed / a.possible)
      .slice(0, BUSIEST_PEOPLE_SHOWN)
    return { status: 'gaveUp', best: result.best, busiest }
  }

  const projectIds = findConflictGroup(problem)
  const relaxations = findRelaxations(problem, projectIds)
  return {
    status: 'impossible',
    failures: [{ type: 'conflictGroup', projectIds, relaxations }],
  }
}
