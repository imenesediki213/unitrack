import type { FormEvent } from 'react'
import { ErrorMessage } from '../components/ErrorMessage'
import { useAction, useLoad } from '../lib/hooks'
import type { Project } from '../lib/types'
import { useLanguage } from '../messages/LanguageContext'
import { listPeople } from '../people/api'
import type { ProjectInput } from './api'

interface Props {
  /** Left out when creating a project. */
  project?: Project
  onSave: (input: ProjectInput) => Promise<unknown>
}

export function ProjectForm({ project, onSave }: Props) {
  const { t } = useLanguage()
  const professors = useLoad(() => listPeople(['supervisor', 'admin']))
  const { run, busy, error } = useAction()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const input = {
      title: String(form.get('title')).trim(),
      supervisor_id: String(form.get('supervisor')),
    }
    void run(() => onSave(input))
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <label>
        {t.projects.projectTitle}
        <input
          name="title"
          defaultValue={project?.title}
          minLength={3}
          maxLength={200}
          required
        />
      </label>
      <label>
        {t.projects.supervisor}
        {/* The key resets the select once the professors, and so its options, are loaded. */}
        <select
          key={professors.data ? 'loaded' : 'loading'}
          name="supervisor"
          defaultValue={project?.supervisor.id ?? ''}
          required
        >
          <option value="">{t.common.choose}</option>
          {professors.data?.map((person) => (
            <option key={person.id} value={person.id}>
              {person.full_name}
            </option>
          ))}
        </select>
      </label>
      <ErrorMessage error={professors.error ?? error} />
      <button type="submit" className="primary" disabled={busy}>
        {t.common.save}
      </button>
    </form>
  )
}
