import { createClient, type PostgrestError } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error('Copy .env.example to .env.local and fill in the Supabase values.')
}

// The publishable (anon) key is public by design: Row-Level Security protects the data.
export const supabase = createClient(url, key)

/** supabase-js returns errors instead of throwing them. This turns them back into exceptions. */
export async function unwrap<T>(
  query: PromiseLike<{ data: unknown; error: PostgrestError | Error | null }>,
): Promise<T> {
  const { data, error } = await query
  if (error) throw error
  return data as T
}
