import { en } from './en'
import { fr, type Messages } from './fr'

export type Language = 'fr' | 'en'

export const messages: Record<Language, Messages> = { fr, en }

const STORAGE_KEY = 'unitrack.language'

export function parseLanguage(value: string | null): Language {
  return value === 'en' ? 'en' : 'fr'
}

// Browsers can block storage (private mode, strict settings). The choice is then not kept.
export function loadLanguage(): Language {
  try {
    return parseLanguage(localStorage.getItem(STORAGE_KEY))
  } catch {
    return 'fr'
  }
}

export function storeLanguage(language: Language) {
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch {
    // Nothing to do: the language still applies to this visit.
  }
}
