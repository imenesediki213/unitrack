import { supabase, unwrap } from '../lib/supabase'
import type { Defense, Room, Settings, TimeSlot } from '../lib/types'

// Rooms ----------------------------------------------------------------------------------

export function listRooms(): Promise<Room[]> {
  return unwrap(supabase.from('rooms').select('id, name').order('name'))
}

export function addRoom(name: string): Promise<void> {
  return unwrap(supabase.from('rooms').insert({ name }))
}

export function removeRoom(id: string): Promise<void> {
  return unwrap(supabase.from('rooms').delete().eq('id', id))
}

// Slots ----------------------------------------------------------------------------------

export function listSlots(): Promise<TimeSlot[]> {
  return unwrap(
    supabase
      .from('time_slots')
      .select('id, day, start_time, end_time')
      .order('day')
      .order('start_time'),
  )
}

export function addSlots(slots: Omit<TimeSlot, 'id'>[]): Promise<void> {
  return unwrap(supabase.from('time_slots').insert(slots))
}

export function removeSlot(id: string): Promise<void> {
  return unwrap(supabase.from('time_slots').delete().eq('id', id))
}

// Settings -------------------------------------------------------------------------------

export function getSettings(): Promise<Settings> {
  return unwrap(
    supabase.from('settings').select('max_defenses_per_day, schedule_published').single(),
  )
}

export function updateSettings(changes: Partial<Settings>): Promise<void> {
  return unwrap(supabase.from('settings').update(changes).eq('id', true))
}

// Schedule -------------------------------------------------------------------------------

/** Only published defenses, except for the admin. The database applies that rule. */
export function listDefenses(): Promise<Defense[]> {
  return unwrap(supabase.from('defenses').select('project_id, slot_id, room_id'))
}

export function saveSchedule(placements: Defense[]): Promise<void> {
  return unwrap(supabase.rpc('save_schedule', { placements }))
}

/** Professor id -> ids of the slots when they are available. */
export async function loadAvailability(): Promise<Map<string, Set<string>>> {
  // Read through the slots: the API returns at most 1000 rows, and a department can have
  // more availability rows than that, but not more slots.
  const slots = await unwrap<{ id: string; availability: { professor_id: string }[] }[]>(
    supabase.from('time_slots').select('id, availability(professor_id)'),
  )

  const availability = new Map<string, Set<string>>()
  for (const slot of slots) {
    for (const { professor_id } of slot.availability) {
      const slotIds = availability.get(professor_id) ?? new Set()
      availability.set(professor_id, slotIds.add(slot.id))
    }
  }
  return availability
}
