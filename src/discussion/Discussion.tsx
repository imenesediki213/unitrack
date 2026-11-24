import type { FormEvent } from 'react'
import { useProfile } from '../auth/AuthContext'
import { ErrorMessage } from '../components/ErrorMessage'
import { Loading } from '../components/Loading'
import { useAction, useLoad } from '../lib/hooks'
import type { Project } from '../lib/types'
import { formatDateTime } from '../messages/format'
import { useLanguage } from '../messages/LanguageContext'
import { listMessages, sendMessage } from './api'
import './discussion.css'

interface Props {
  project: Project
  onChange: () => void
}

/** The messages between the students of a project and their supervisor. */
export function Discussion({ project, onChange }: Props) {
  const { t, language } = useLanguage()
  const me = useProfile()
  const messages = useLoad(() => listMessages(project.id), project.id)
  const { run, busy, error } = useAction()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const body = String(new FormData(form).get('body')).trim()
    if (await run(() => sendMessage(project.id, body))) {
      form.reset()
      messages.reload()
      onChange()
    }
  }

  if (!messages.data) return <Loading error={messages.error} />

  return (
    <section>
      <h2>{t.discussion.title}</h2>
      <p className="hint">
        {t.discussion.hint}{' '}
        <button type="button" className="link-button" onClick={messages.reload}>
          {t.discussion.refresh}
        </button>
      </p>
      {messages.data.length === 0 && <p className="muted">{t.discussion.empty}</p>}
      <ol className="discussion">
        {messages.data.map((message) => (
          <li key={message.id} className={message.author?.id === me.id ? 'mine' : undefined}>
            <p className="discussion-author">
              {/* The name of a student who left the project is no longer visible. */}
              <strong>{message.author?.full_name ?? t.discussion.formerMember}</strong>{' '}
              <span>{formatDateTime(language, message.created_at)}</span>
            </p>
            <p>{message.body}</p>
          </li>
        ))}
      </ol>
      <form className="stack" onSubmit={handleSubmit}>
        <label>
          {t.discussion.message}
          <textarea name="body" rows={3} maxLength={2000} required />
        </label>
        <ErrorMessage error={error ?? messages.error} />
        <button type="submit" disabled={busy}>
          {t.discussion.send}
        </button>
      </form>
    </section>
  )
}
