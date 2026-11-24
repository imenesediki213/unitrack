import type { FormEvent } from 'react'
import { ErrorMessage } from '../components/ErrorMessage'
import { useAction, useLoad } from '../lib/hooks'
import type { JuryRole, Project } from '../lib/types'
import { useLanguage } from '../messages/LanguageContext'
import { listPeople } from '../people/api'
import { addJuryMember, addStudent, removeJuryMember, removeStudent } from './api'
import { isJuryComplete } from './jury'

interface Props {
  project: Project
  canEdit: boolean
  onChange: () => void
}

/** The people of a project. The admin can change the students and the jury. */
export function Team({ project, canEdit, onChange }: Props) {
  const { t } = useLanguage()
  const { run, busy, error } = useAction()

  async function change(action: () => Promise<unknown>) {
    if (await run(action)) onChange()
  }

  function removeButton(name: string, action: () => Promise<unknown>) {
    if (!canEdit) return null
    return (
      <button
        type="button"
        className="link-button"
        aria-label={`${t.common.remove} ${name}`}
        disabled={busy}
        onClick={() => change(action)}
      >
        {t.common.remove}
      </button>
    )
  }

  return (
    <section className="team">
      <div>
        <h2>{t.projects.students}</h2>
        {project.students.length === 0 && <p className="muted">{t.projects.noStudents}</p>}
        <ul className="people">
          {project.students.map((student) => (
            <li key={student.id}>
              {student.full_name}
              {removeButton(student.full_name, () => removeStudent(project.id, student.id))}
            </li>
          ))}
        </ul>
        {canEdit && (
          <AddStudent
            project={project}
            busy={busy}
            onAdd={(id) => change(() => addStudent(project.id, id))}
          />
        )}
      </div>

      <div>
        <h2>{t.projects.jury}</h2>
        <ul className="people">
          <li>
            {project.supervisor.full_name}
            <span className="muted">{t.projects.supervisor}</span>
          </li>
          {project.jury.map(({ person, role }) => (
            <li key={person.id}>
              {person.full_name}
              <span className="muted">{t.projects[role]}</span>
              {removeButton(person.full_name, () => removeJuryMember(project.id, person.id))}
            </li>
          ))}
        </ul>
        {!isJuryComplete(project.jury) && <p className="muted">{t.projects.incompleteJury}</p>}
        {canEdit && (
          <AddJuryMember
            project={project}
            busy={busy}
            onAdd={(id, role) => change(() => addJuryMember(project.id, id, role))}
          />
        )}
      </div>
      <ErrorMessage error={error} />
    </section>
  )
}

interface AddStudentProps {
  project: Project
  busy: boolean
  onAdd: (studentId: string) => void
}

function AddStudent({ project, busy, onAdd }: AddStudentProps) {
  const { t } = useLanguage()
  const students = useLoad(() => listPeople(['student']))
  const currentIds = project.students.map((student) => student.id)
  const choices = students.data?.filter((student) => !currentIds.includes(student.id)) ?? []

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onAdd(String(new FormData(event.currentTarget).get('student')))
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit}>
      <select name="student" aria-label={t.projects.person} required>
        <option value="">{t.common.choose}</option>
        {choices.map((student) => (
          <option key={student.id} value={student.id}>
            {student.full_name}
          </option>
        ))}
      </select>
      <button type="submit" disabled={busy}>
        {t.common.add}
      </button>
    </form>
  )
}

interface AddJuryMemberProps {
  project: Project
  busy: boolean
  onAdd: (professorId: string, role: JuryRole) => void
}

function AddJuryMember({ project, busy, onAdd }: AddJuryMemberProps) {
  const { t } = useLanguage()
  const professors = useLoad(() => listPeople(['supervisor', 'admin']))
  const currentIds = [project.supervisor.id, ...project.jury.map(({ person }) => person.id)]
  const choices = professors.data?.filter((person) => !currentIds.includes(person.id)) ?? []
  const hasPresident = project.jury.some((member) => member.role === 'president')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    onAdd(String(form.get('professor')), String(form.get('role')) as JuryRole)
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit}>
      <select name="professor" aria-label={t.projects.person} required>
        <option value="">{t.common.choose}</option>
        {choices.map((person) => (
          <option key={person.id} value={person.id}>
            {person.full_name}
          </option>
        ))}
      </select>
      <select name="role" aria-label={t.projects.juryRole}>
        {!hasPresident && <option value="president">{t.projects.president}</option>}
        <option value="examiner">{t.projects.examiner}</option>
      </select>
      <button type="submit" disabled={busy}>
        {t.common.add}
      </button>
    </form>
  )
}
