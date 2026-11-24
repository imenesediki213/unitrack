import { createContext, use, useEffect, useState, type ReactNode } from 'react'
import type { Messages } from './fr'
import { loadLanguage, messages, storeLanguage, type Language } from './language'

interface LanguageValue {
  language: Language
  t: Messages
  setLanguage: (language: Language) => void
}

const LanguageContext = createContext<LanguageValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState(loadLanguage)

  useEffect(() => {
    document.documentElement.lang = language
    storeLanguage(language)
  }, [language])

  return (
    <LanguageContext value={{ language, t: messages[language], setLanguage }}>
      {children}
    </LanguageContext>
  )
}

export function useLanguage(): LanguageValue {
  const value = use(LanguageContext)
  if (!value) throw new Error('useLanguage must be used inside LanguageProvider')
  return value
}
