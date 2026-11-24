import type { TimeSlot } from '../lib/types'

/** Cuts a period of a day into consecutive slots. A last slot that does not fit is dropped. */
export function buildDaySlots(
  day: string,
  from: string,
  to: string,
  minutes: number,
): Omit<TimeSlot, 'id'>[] {
  if (!day || !from || !to || !Number.isInteger(minutes) || minutes < 5) return []

  const slots: Omit<TimeSlot, 'id'>[] = []
  const end = toMinutes(to)
  for (let start = toMinutes(from); start + minutes <= end; start += minutes) {
    slots.push({ day, start_time: toTime(start), end_time: toTime(start + minutes) })
  }
  return slots
}

/** Groups slots that are already in chronological order. */
export function groupByDay(slots: TimeSlot[]): [day: string, slots: TimeSlot[]][] {
  return [...Map.groupBy(slots, (slot) => slot.day)]
}

function toMinutes(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function toTime(total: number): string {
  const hours = String(Math.floor(total / 60)).padStart(2, '0')
  const minutes = String(total % 60).padStart(2, '0')
  return `${hours}:${minutes}`
}
