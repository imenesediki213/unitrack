import { useState, type FormEvent } from 'react'
import { ErrorMessage } from '../components/ErrorMessage'
import { useAction } from '../lib/hooks'
import type { Theme } from '../lib/types'
import { useLanguage } from '../messages/LanguageContext'
import { askForTheme } from './requests'

/** Lets a student ask for a theme, with a short motivation. */
export function AskForm({ theme, onAsked }: { theme: Theme; onAsked: () => void }) {
  const { t } = useLanguage()
  const { run, busy, error } = useAction()
  const [writing, setWriting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = String(new FormData(event.currentTarget).get('message')).trim()
    if (await run(() => askForTheme(theme.id, message))) onAsked()
  }

  if (!writing) {
    return (
      <div className="actions">
        <button
          type="button"
          className="primary"
          aria-label={t.requests.askFor(theme.title)}
          onClick={() => setWriting(true)}
        >
          {t.requests.ask}
        </button>
      </div>
    )
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <label>
        {t.requests.message}
        <textarea name="message" rows={3} minLength={10} maxLength={1000} required autoFocus />
      </label>
      <div className="actions">
        <button type="submit" className="primary" disabled={busy}>
          {t.themes.send}
        </button>
        <button type="button" onClick={() => setWriting(false)}>
          {t.common.cancel}
        </button>
      </div>
      <ErrorMessage error={error} />
    </form>
  )
}
