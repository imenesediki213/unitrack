import { useEffect, useState } from 'react'

/** Loads data when the component appears and whenever `key` changes. */
export function useLoad<T>(load: () => Promise<T>, key = '') {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [reloads, setReloads] = useState(0)

  useEffect(() => {
    // Answers can arrive out of order: one for an earlier key must be ignored.
    let isCurrent = true

    load().then(
      (result) => {
        if (!isCurrent) return
        setData(result)
        setError(null)
      },
      (reason) => {
        if (isCurrent) setError(reason)
      },
    )

    return () => {
      isCurrent = false
    }
  }, [key, reloads])

  return { data, error, reload: () => setReloads((count) => count + 1) }
}

/** Runs something that changes data, and remembers whether it is running or failed. */
export function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  /** Returns true when the action succeeded. */
  async function run(action: () => Promise<unknown>): Promise<boolean> {
    setBusy(true)
    setError(null)
    try {
      await action()
      return true
    } catch (reason) {
      setError(reason)
      return false
    } finally {
      setBusy(false)
    }
  }

  return { run, busy, error }
}
