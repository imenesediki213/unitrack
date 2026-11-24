import { useState, type ReactNode } from 'react'
import { useProfile } from '../auth/AuthContext'
import { AnswerForm } from '../components/AnswerForm'
import { ErrorMessage } from '../components/ErrorMessage'
import { useAction } from '../lib/hooks'
import type { Theme } from '../lib/types'
import { useLanguage } from '../messages/LanguageContext'
import { removeTheme, reviewTheme, updateTheme } from './api'
import { ThemeForm } from './ThemeForm'
import { canEdit, canRemove, canReview } from './rules'

interface Props {
  theme: Theme
  /** The class that gives the colour of the professor. */
  tint?: string
  onChange: () => void
  children?: ReactNode
}

/** A theme, with the actions that the user may take on it. */
export function ThemeCard({ theme, tint = '', onChange, children }: Props) {
  const { t } = useLanguage()
  const me = useProfile()
  const { run, busy, error } = useAction()
  const [editing, setEditing] = useState(false)

  async function handleRemove() {
    if (!window.confirm(t.themes.confirmRemove)) return
    if (await run(() => removeTheme(theme.id))) onChange()
  }

  return (
    <li className={`theme ${tint}`}>
      <h3>{theme.title}</h3>
      <p>
        {theme.professor.full_name} · {t.themes.forStudents(theme.capacity)}
      </p>
      <p className="theme-description">{theme.description}</p>
      {theme.proposer && theme.proposer.id !== me.id && (
        <p>{t.themes.proposedBy(theme.proposer.full_name)}</p>
      )}
      {theme.status !== 'open' && <span className="card-tag">{t.themes.status[theme.status]}</span>}
      {theme.refusal_reason && <p>{t.answers.reason(theme.refusal_reason)}</p>}

      {canReview(theme, me) && (
        <AnswerForm
          onAnswer={(accepted, reason) => reviewTheme(theme.id, accepted, reason)}
          onDone={onChange}
        />
      )}
      {children}

      {(canEdit(theme, me) || canRemove(theme, me)) && (
        <div className="actions">
          {canEdit(theme, me) && (
            <button type="button" aria-expanded={editing} onClick={() => setEditing(!editing)}>
              {t.themes.edit}
            </button>
          )}
          {canRemove(theme, me) && (
            <button type="button" className="danger" disabled={busy} onClick={handleRemove}>
              {t.themes.remove}
            </button>
          )}
        </div>
      )}
      <ErrorMessage error={error} />
      {editing && canEdit(theme, me) && (
        <ThemeForm
          theme={theme}
          professorId={theme.professor.id}
          submitLabel={t.themes.resubmit}
          onSave={async ({ title, description, capacity }) => {
            await updateTheme(theme.id, { title, description, capacity })
            setEditing(false)
            onChange()
          }}
        />
      )}
    </li>
  )
}
