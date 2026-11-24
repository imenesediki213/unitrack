import { Link } from 'react-router'
import { ErrorMessage } from '../components/ErrorMessage'
import { Loading } from '../components/Loading'
import { useAction, useLoad } from '../lib/hooks'
import { formatList, formatMark } from '../messages/format'
import { useLanguage } from '../messages/LanguageContext'
import { getSettings, updateSettings } from '../planning/api'
import { listProjects } from '../projects/api'
import { listResults } from './api'

/** Every mark, for the admin, who publishes them. */
export function ResultsPage() {
  const { t, language } = useLanguage()
  const page = useLoad(() => Promise.all([listProjects(), listResults(), getSettings()]))
  const { run, busy, error } = useAction()

  if (!page.data) return <Loading error={page.error} />
  const [projects, results, settings] = page.data
  const isPublished = settings.results_published
  const defended = projects.filter(({ status }) => status === 'defended')

  async function handlePublish() {
    if (!isPublished && !window.confirm(t.results.confirmPublish)) return
    if (await run(() => updateSettings({ results_published: !isPublished }))) page.reload()
  }

  return (
    <>
      <h1>{t.results.pageTitle}</h1>
      <div className="phase actions">
        <span className="muted">{isPublished ? t.results.published : t.results.draft}</span>
        <button type="button" disabled={busy} onClick={handlePublish}>
          {isPublished ? t.planning.unpublish : t.planning.publish}
        </button>
      </div>
      <ErrorMessage error={error ?? page.error} />

      {defended.length === 0 ? (
        <p className="muted">{t.results.noneDefended}</p>
      ) : (
        <div className="table-scroll">
          <table className="ledger">
            <thead>
              <tr>
                <th scope="col">{t.results.project}</th>
                <th scope="col">{t.projects.students}</th>
                <th scope="col">{t.projects.president}</th>
                <th scope="col">{t.results.markColumn}</th>
              </tr>
            </thead>
            <tbody>
              {defended.map((project) => {
                const result = results.find(({ project_id }) => project_id === project.id)
                const president = project.jury.find(({ role }) => role === 'president')
                return (
                  <tr key={project.id}>
                    <td>
                      <Link to={`/projects/${project.id}`}>{project.title}</Link>
                    </td>
                    <td>
                      {formatList(language, project.students.map((student) => student.full_name))}
                    </td>
                    <td>{president?.person.full_name}</td>
                    <td>{result ? formatMark(language, result.mark) : t.results.missing}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
