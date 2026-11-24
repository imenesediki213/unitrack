import { useState, type FormEvent } from 'react'
import { useProfile } from '../auth/AuthContext'
import { ErrorMessage } from '../components/ErrorMessage'
import { useAction, useLoad } from '../lib/hooks'
import type { Project, Result } from '../lib/types'
import { formatMark } from '../messages/format'
import { useLanguage } from '../messages/LanguageContext'
import { getSettings } from '../planning/api'
import { addResult, correctResult, listResults } from './api'

interface Props {
  project: Project
  onChange: () => void
}

/** The mark of a defended project. The president enters it, and corrects it until publication. */
export function ResultSection({ project, onChange }: Props) {
  const { t, language } = useLanguage()
  const me = useProfile()
  const page = useLoad(() => Promise.all([listResults(), getSettings()]), project.id)
  const [editing, setEditing] = useState(false)

  if (project.status !== 'defended') return null
  if (!page.data) return <ErrorMessage error={page.error} />

  const [results, settings] = page.data
  const result = results.find(({ project_id }) => project_id === project.id)
  const isPresident = project.jury.some(
    ({ person, role }) => role === 'president' && person.id === me.id,
  )
  const canCorrect = isPresident && result !== undefined && !settings.results_published

  function handleSaved() {
    setEditing(false)
    page.reload()
    onChange()
  }

  return (
    <section className="defense">
      <h2>{t.results.title}</h2>
      {result && (
        <>
          <p className="defense-when">{formatMark(language, result.mark)}</p>
          {result.remarks && <p>{result.remarks}</p>}
          {!settings.results_published && <p className="hint">{t.results.notPublished}</p>}
        </>
      )}
      {!result && !isPresident && <p className="muted">{t.results.waiting}</p>}
      {canCorrect && !editing && (
        <button type="button" onClick={() => setEditing(true)}>
          {t.results.correct}
        </button>
      )}
      {((isPresident && !result) || (canCorrect && editing)) && (
        <ResultForm projectId={project.id} result={result} onSaved={handleSaved} />
      )}
      <ErrorMessage error={page.error} />
    </section>
  )
}

interface ResultFormProps {
  projectId: string
  /** Left out when entering the first one. */
  result?: Result
  onSaved: () => void
}

function ResultForm({ projectId, result, onSaved }: ResultFormProps) {
  const { t } = useLanguage()
  const { run, busy, error } = useAction()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const values = {
      project_id: projectId,
      mark: Number(form.get('mark')),
      remarks: String(form.get('remarks')).trim() || null,
    }
    if (await run(() => (result ? correctResult(values) : addResult(values)))) onSaved()
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <label>
        {t.results.mark}
        <input
          name="mark"
          type="number"
          min={0}
          max={20}
          step={0.25}
          defaultValue={result?.mark}
          required
        />
      </label>
      <label>
        {t.results.remarks}
        <textarea name="remarks" rows={4} maxLength={2000} defaultValue={result?.remarks ?? ''} />
      </label>
      <ErrorMessage error={error} />
      <button type="submit" className="primary" disabled={busy}>
        {t.common.save}
      </button>
    </form>
  )
}
