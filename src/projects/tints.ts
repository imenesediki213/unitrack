/** The .tint-… classes of tokens.css. */
const TINT_COUNT = 6

/**
 * Gives each professor a card colour. Beyond six professors the colours repeat, so a colour
 * never replaces a name.
 */
export function tintsFor(professorIds: string[]): Map<string, string> {
  const ids = [...new Set(professorIds)].sort()
  return new Map(ids.map((id, index) => [id, `tint-${index % TINT_COUNT}`]))
}
