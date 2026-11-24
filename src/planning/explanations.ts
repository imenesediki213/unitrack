import { formatDay, formatList, formatTime } from '../messages/format'
import type { Messages } from '../messages/fr'
import type { Language } from '../messages/language'
import type { Conflict, Failure, Relaxation } from '../scheduler'
import type { PlanningData } from './board'

/** Turns the ids that the scheduler works with into sentences. */
export function createExplainer(data: PlanningData, t: Messages, language: Language) {
  const titles = new Map(data.projects.map((project) => [project.id, project.title]))
  const rooms = new Map(data.rooms.map((room) => [room.id, room.name]))
  const slots = new Map(data.slots.map((slot) => [slot.id, slot]))
  const people = new Map(
    data.projects
      .flatMap((project) => [project.supervisor, ...project.jury.map(({ person }) => person)])
      .map((person) => [person.id, person.full_name]),
  )

  const title = (id: string) => titles.get(id) ?? '?'
  const person = (id: string) => people.get(id) ?? '?'
  const day = (value: string) => formatDay(language, value)
  const list = (items: string[]) => formatList(language, items)

  function slotName(id: string): string {
    const slot = slots.get(id)
    return slot ? `${day(slot.day)}, ${formatTime(slot.start_time)}` : '?'
  }

  function conflict(item: Conflict): string {
    switch (item.type) {
      case 'roomDoubleBooked':
        return t.conflicts.roomDoubleBooked(rooms.get(item.roomId) ?? '?', slotName(item.slotId))
      case 'personDoubleBooked':
        return t.conflicts.personDoubleBooked(
          person(item.personId),
          item.projectIds.length,
          slotName(item.slotId),
        )
      case 'personUnavailable':
        return t.conflicts.personUnavailable(
          person(item.personId),
          slotName(item.slotId),
          list(item.projectIds.map(title)),
        )
      case 'dayLimitExceeded':
        return t.conflicts.dayLimitExceeded(
          person(item.personId),
          item.projectIds.length,
          day(item.day),
          item.max,
        )
      case 'incompleteJury':
        return t.conflicts.incompleteJury(list(item.projectIds.map(title)))
    }
  }

  function failure(item: Failure): string {
    switch (item.type) {
      case 'noRooms':
        return t.failures.noRooms
      case 'noSlots':
        return t.failures.noSlots
      case 'incompleteJury':
        return t.failures.incompleteJury(title(item.projectId))
      case 'noCommonSlot':
        return item.blockers.length === 0
          ? t.failures.noCommonSlot(title(item.projectId))
          : t.failures.noCommonSlotBecause(title(item.projectId), list(item.blockers.map(person)))
      case 'notEnoughCapacity':
        return t.failures.notEnoughCapacity(item.needed, item.possible)
      case 'personOverloaded':
        return t.failures.personOverloaded(person(item.personId), item.needed, item.possible)
      case 'dayOverloaded':
        return t.failures.dayOverloaded(
          person(item.personId),
          item.needed,
          day(item.day),
          item.possible,
        )
      case 'conflictGroup':
        return item.projectIds.length === 1
          ? t.failures.oneProject(title(item.projectIds[0]!))
          : t.failures.conflictGroup(list(item.projectIds.map((id) => `« ${title(id)} »`)))
    }
  }

  function relaxation(item: Relaxation): string {
    switch (item.type) {
      case 'addRoom':
        return t.failures.addRoom
      case 'raiseDayLimit':
        return t.failures.raiseDayLimit(item.max)
      case 'freePerson':
        return t.failures.freePerson(person(item.personId), day(item.day))
    }
  }

  return { conflict, failure, relaxation, person }
}

export type Explainer = ReturnType<typeof createExplainer>
