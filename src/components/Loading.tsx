import { useLanguage } from '../messages/LanguageContext'
import { ErrorMessage } from './ErrorMessage'

/** Shown while data loads, or instead of it when loading failed. */
export function Loading({ error }: { error?: unknown }) {
  const { t } = useLanguage()
  if (error) return <ErrorMessage error={error} />
  return <p className="muted">{t.common.loading}</p>
}
