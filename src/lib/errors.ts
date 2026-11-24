import type { Messages } from '../messages/fr'

/**
 * Finds the message for an error. The database raises short names such as "role_in_use";
 * constraint and sign-in errors are recognised by their code.
 */
export function errorText(t: Messages, error: unknown): string {
  const { code, message } = error as { code?: string; message?: string }

  if (message && Object.hasOwn(t.errors, message)) return t.errors[message as keyof Messages['errors']]
  if (code && Object.hasOwn(t.errors, code)) return t.errors[code as keyof Messages['errors']]
  if (message?.includes('Failed to fetch')) return t.errors.network
  return t.errors.unknown
}
