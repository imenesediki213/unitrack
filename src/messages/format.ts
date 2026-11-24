import type { Language } from './language'

/** "2027-06-15" -> "mardi 15 juin 2027" */
export function formatDay(language: Language, day: string): string {
  return new Intl.DateTimeFormat(language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`))
}

/** A moment, as a day in the user's time zone. */
export function formatDate(language: Language, timestamp: string): string {
  return new Intl.DateTimeFormat(language, { dateStyle: 'long' }).format(new Date(timestamp))
}

export function formatDateTime(language: Language, timestamp: string): string {
  return new Intl.DateTimeFormat(language, { dateStyle: 'long', timeStyle: 'short' }).format(
    new Date(timestamp),
  )
}

/** "09:30:00" -> "09:30" */
export function formatTime(time: string): string {
  return time.slice(0, 5)
}

export function formatList(language: Language, items: string[]): string {
  return new Intl.ListFormat(language, { type: 'conjunction' }).format(items)
}
