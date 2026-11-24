import type { FormEvent } from 'react'
import { ErrorMessage } from '../components/ErrorMessage'
import { useAction, useLoad } from '../lib/hooks'
import type { Theme } from '../lib/types'
import { useLanguage } from '../messages/LanguageContext'
import { listPeople } from '../people/api'
import type { ThemeInput } from './api'

interface Props {
  /** Left out when adding a theme. */
  theme?: Theme
  /** The professor of the theme. Left out when the user chooses one. */
  professorId?: string
  submitLabel: string
  onSave: (input: ThemeInput) => Promise<unknown>
}

export function ThemeForm({ theme, professorId, submitLabel, onSave }: Props) {
  const { t } = useLanguage()
  const { run, busy, error } = useAction()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    const input = {
      title: String(values.get('title')).trim(),
      description: String(values.get('description')).trim(),
      capacity: Number(values.get('capacity')),
      professor_id: professorId ?? String(values.get('professor')),
    }
    if (await run(() => onSave(input))) form.reset()
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <label>
        {t.themes.themeTitle}
        <input
          name="title"
          defaultValue={theme?.title}
          minLength={3}
          maxLength={200}
          pattern=".*\S.*"
          required
        />
      </label>
      <label>
        {t.themes.description}
        <textarea
          name="description"
          rows={4}
          defaultValue={theme?.description}
          minLength={10}
          maxLength={2000}
          required
        />
      </label>
      {!professorId && <ProfessorSelect />}
      <label>
        {t.themes.capacity}
        <select name="capacity" defaultValue={theme?.capacity ?? 1}>
          {[1, 2].map((count) => (
            <option key={count} value={count}>
              {t.themes.forStudents(count)}
            </option>
          ))}
        </select>
      </label>
      <ErrorMessage error={error} />
      <button type="submit" className="primary" disabled={busy}>
        {submitLabel}
      </button>
    </form>
  )
}

function ProfessorSelect() {
  const { t } = useLanguage()
  const professors = useLoad(() => listPeople(['supervisor', 'admin']))

  return (
    <label>
      {t.projects.supervisor}
      <select name="professor" required>
        <option value="">{t.common.choose}</option>
        {professors.data?.map((person) => (
          <option key={person.id} value={person.id}>
            {person.full_name}
          </option>
        ))}
      </select>
      <ErrorMessage error={professors.error} />
    </label>
  )
}
