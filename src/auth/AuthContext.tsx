import { createContext, use, useEffect, useState, type ReactNode } from 'react'
import { supabase, unwrap } from '../lib/supabase'
import type { Profile } from '../lib/types'

interface AuthValue {
  /** True until we know whether someone is signed in and who they are. */
  loading: boolean
  error: unknown
  profile: Profile | null
  signOut: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // undefined: not known yet. null: nobody is signed in.
  const [userId, setUserId] = useState<string | null | undefined>(undefined)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // Not done inside the callback above: calling Supabase from there can deadlock.
  useEffect(() => {
    let isCurrent = true
    setProfile(null)
    setError(null)

    if (userId) {
      loadProfile(userId).then(
        (loaded) => isCurrent && setProfile(loaded),
        (reason) => isCurrent && setError(reason),
      )
    }
    return () => {
      isCurrent = false
    }
  }, [userId])

  const loading = userId === undefined || (userId !== null && profile?.id !== userId && !error)

  return (
    <AuthContext value={{ loading, error, profile, signOut }}>{children}</AuthContext>
  )
}

export function useAuth(): AuthValue {
  const value = use(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}

/** For pages that are only shown to signed-in users. */
export function useProfile(): Profile {
  const { profile } = useAuth()
  if (!profile) throw new Error('useProfile needs a signed-in user')
  return profile
}

function loadProfile(userId: string): Promise<Profile> {
  return unwrap(
    supabase.from('profiles').select('id, full_name, role').eq('id', userId).single(),
  )
}

function signOut() {
  // "local" signs out of this browser only.
  void supabase.auth.signOut({ scope: 'local' })
}
