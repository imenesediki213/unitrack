import { errorText } from '../lib/errors'
import { useLanguage } from '../messages/LanguageContext'

export function ErrorMessage({ error }: { error: unknown }) {
  const { t } = useLanguage()
  if (!error) return null
  return (
    <p className="error" role="alert">
      {errorText(t, error)}
    </p>
  )
}
