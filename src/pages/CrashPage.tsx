import { useLanguage } from '../messages/LanguageContext'

/** Replaces the page when a component throws an unexpected error. */
export function CrashPage() {
  const { t } = useLanguage()
  return (
    <main className="narrow">
      <h1>UniTrack</h1>
      <p>{t.errors.unknown}</p>
      {/* A full page load, so that the app starts again from a clean state. */}
      <a href="/">{t.notFound.back}</a>
    </main>
  )
}
