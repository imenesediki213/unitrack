import { Link } from 'react-router'
import { useLanguage } from '../messages/LanguageContext'

export function NotFoundPage() {
  const { t } = useLanguage()
  return (
    <div className="narrow">
      <h1>{t.notFound.title}</h1>
      <p>{t.notFound.text}</p>
      <Link to="/">{t.notFound.back}</Link>
    </div>
  )
}
