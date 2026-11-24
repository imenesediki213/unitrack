const DAY_IN_MS = 24 * 60 * 60 * 1000

/** The admin chooses a day: reports are late from the end of it, in the admin's time zone. */
export function endOfDay(day: string): string {
  return new Date(`${day}T23:59:59`).toISOString()
}

/** The opposite, to fill in a date field. */
export function dayOf(deadline: string): string {
  const date = new Date(deadline)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function isLate(uploadedAt: string, deadline: string | null): boolean {
  return deadline !== null && new Date(uploadedAt) > new Date(deadline)
}

/** Calendar days: 0 is the last day, and a negative number means that it is over. */
export function daysLeft(deadline: string, now: Date): number {
  const midnight = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  return (midnight(new Date(deadline)) - midnight(now)) / DAY_IN_MS
}
