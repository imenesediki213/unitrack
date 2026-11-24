import type { Project } from '../lib/types'

/** The .tint-… classes of tokens.css. */
const TINT_COUNT = 6

/**
 * Gives each supervisor a card colour. Beyond six supervisors the colours repeat, so a colour
 * never replaces a name.
 */
export function supervisorTints(projects: Project[]): Map<string, string> {
  const supervisorIds = new Set(projects.map((project) => project.supervisor.id))
  return new Map([...supervisorIds].sort().map((id, index) => [id, `tint-${index % TINT_COUNT}`]))
}
