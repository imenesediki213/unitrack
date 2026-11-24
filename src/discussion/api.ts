import { supabase, unwrap } from '../lib/supabase'
import type { LastMessage, Message } from '../lib/types'

export function listMessages(projectId: string): Promise<Message[]> {
  return unwrap(
    supabase
      .from('messages')
      .select('id, body, created_at, author:profiles!author_id(id, full_name)')
      .eq('project_id', projectId)
      .order('created_at'),
  )
}

export function sendMessage(project_id: string, body: string): Promise<void> {
  return unwrap(supabase.from('messages').insert({ project_id, body }))
}

/** Who wrote last in each discussion of the user. */
export function listLastMessages(): Promise<LastMessage[]> {
  return unwrap(supabase.from('last_messages').select('project_id, author_id'))
}
