import { supabase, unwrap } from '../lib/supabase'
import type { Account, Person, Role } from '../lib/types'

export function listAccounts(): Promise<Account[]> {
  return unwrap(supabase.rpc('list_accounts'))
}

/** Professors include the head of department, who can also supervise and sit on juries. */
export function listPeople(roles: Role[]): Promise<Person[]> {
  return unwrap(
    supabase.from('profiles').select('id, full_name').in('role', roles).order('full_name'),
  )
}

export function setRole(id: string, role: Role | null): Promise<void> {
  return unwrap(supabase.from('profiles').update({ role }).eq('id', id))
}
