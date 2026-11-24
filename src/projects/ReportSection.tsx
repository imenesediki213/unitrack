import { useState, type FormEvent } from 'react'
import { useProfile } from '../auth/AuthContext'
import { ErrorMessage } from '../components/ErrorMessage'
import { Loading } from '../components/Loading'
import { useAction, useLoad } from '../lib/hooks'
import type { Project, ReportVersion } from '../lib/types'
import { formatDateTime } from '../messages/format'
import { useLanguage } from '../messages/LanguageContext'
import { downloadReport, listVersions, reviewVersion, submitVersion } from './reports'

interface Props {
  project: Project
  /** Submitting or reviewing a version also changes the status of the project. */
  onChange: () => void
}

export function ReportSection({ project, onChange }: Props) {
  const { t } = useLanguage()
  const me = useProfile()
  const versions = useLoad(() => listVersions(project.id), project.id)

  const isStudent = project.students.some((student) => student.id === me.id)
  const isSupervisor = project.supervisor.id === me.id

  function handleChange() {
    versions.reload()
    onChange()
  }

  if (!versions.data) return <Loading error={versions.error} />
  const pending = versions.data.find((version) => version.decision === 'pending')

  return (
    <section>
      <h2>{t.reports.title}</h2>
      {isStudent && project.status === 'in_progress' && (
        <SubmitForm projectId={project.id} onSubmit={handleChange} />
      )}
      {isStudent && pending && <p className="muted">{t.reports.waiting}</p>}
      {isSupervisor && pending && (
        <ReviewForm key={pending.id} version={pending} onReview={handleChange} />
      )}

      {versions.data.length === 0 && <p className="muted">{t.reports.empty}</p>}
      <ol className="versions">
        {versions.data.map((version) => (
          <Version key={version.id} version={version} />
        ))}
      </ol>
    </section>
  )
}

function Version({ version }: { version: ReportVersion }) {
  const { t, language } = useLanguage()
  const { run, busy, error } = useAction()

  return (
    <li className={`version version-${version.decision}`}>
      <div className="version-heading">
        <h3>{t.reports.version(version.version_number)}</h3>
        <span className="tag">{t.reports.decision[version.decision]}</span>
      </div>
      <p className="muted">
        {t.reports.uploadedOn(formatDateTime(language, version.uploaded_at))}
      </p>
      {version.comment && <blockquote>{version.comment}</blockquote>}
      <button
        type="button"
        className="link-button"
        disabled={busy}
        onClick={() => run(() => downloadReport(version))}
      >
        {t.reports.download}
      </button>
      <ErrorMessage error={error} />
    </li>
  )
}

function SubmitForm({ projectId, onSubmit }: { projectId: string; onSubmit: () => void }) {
  const { t } = useLanguage()
  const { run, busy, error } = useAction()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const file = new FormData(event.currentTarget).get('file') as File
    if (await run(() => submitVersion(projectId, file))) onSubmit()
  }

  return (
    <form className="panel stack" onSubmit={handleSubmit}>
      <h3>{t.reports.submitTitle}</h3>
      <label>
        {t.reports.file}
        <input name="file" type="file" accept="application/pdf" required />
      </label>
      <ErrorMessage error={error} />
      <button type="submit" className="primary" disabled={busy}>
        {t.reports.submit}
      </button>
    </form>
  )
}

function ReviewForm({ version, onReview }: { version: ReportVersion; onReview: () => void }) {
  const { t } = useLanguage()
  const { run, busy, error } = useAction()
  const [comment, setComment] = useState('')

  async function review(decision: 'approved' | 'changes_requested') {
    if (await run(() => reviewVersion(version.id, decision, comment))) onReview()
  }

  return (
    <div className="panel stack">
      <h3>
        {t.reports.reviewTitle} · {t.reports.version(version.version_number)}
      </h3>
      <label>
        {t.reports.comment}
        <textarea
          rows={4}
          maxLength={4000}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
        <span className="hint">{t.reports.commentHint}</span>
      </label>
      <ErrorMessage error={error} />
      <div className="actions">
        <button
          type="button"
          className="primary"
          disabled={busy}
          onClick={() => review('approved')}
        >
          {t.reports.approve}
        </button>
        <button
          type="button"
          disabled={busy || comment.trim() === ''}
          onClick={() => review('changes_requested')}
        >
          {t.reports.requestChanges}
        </button>
      </div>
      <p className="hint">{t.reports.approveNote}</p>
    </div>
  )
}
