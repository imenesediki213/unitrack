import { Loading } from '../components/Loading'
import { useLoad } from '../lib/hooks'
import { useLanguage } from '../messages/LanguageContext'
import { listStudentsWithoutProject } from './requests'

/** For the admin, who can put them in a project directly. */
export function StudentsWithoutProject() {
  const { t } = useLanguage()
  const students = useLoad(listStudentsWithoutProject)

  if (!students.data) return <Loading error={students.error} />
  if (students.data.length === 0) return null

  return (
    <details className="panel">
      <summary>{t.requests.withoutProject(students.data.length)}</summary>
      <ul className="people">
        {students.data.map((student) => {
          const waiting = student.theme_requests.filter(({ status }) => status === 'pending')
          return (
            <li key={student.id}>
              {student.full_name}
              <span className="muted">{t.requests.waitingCount(waiting.length)}</span>
            </li>
          )
        })}
      </ul>
      <p className="hint">{t.requests.assignHint}</p>
    </details>
  )
}
