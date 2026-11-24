import { supabase, unwrap } from '../lib/supabase'

export async function listAvailableSlots(professorId: string): Promise<Set<string>> {
  const rows = await unwrap<{ slot_id: string }[]>(
    supabase.from('availability').select('slot_id').eq('professor_id', professorId),
  )
  return new Set(rows.map((row) => row.slot_id))
}

export function setAvailable(
  professor_id: string,
  slot_id: string,
  isAvailable: boolean,
): Promise<void> {
  if (isAvailable) return unwrap(supabase.from('availability').insert({ professor_id, slot_id }))
  return unwrap(
    supabase.from('availability').delete().eq('professor_id', professor_id).eq('slot_id', slot_id),
  )
}
