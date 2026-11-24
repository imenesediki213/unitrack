import { Link, useNavigate } from 'react-router'
import { useProfile } from '../auth/AuthContext'
import { Loading } from '../components/Loading'
import { useLoad } from '../lib/hooks'
import type { Project } from '../lib/types'
import { formatList } from '../messages/format'
import { useLanguage } from '../messages/LanguageContext'
import { NextSteps } from '../nextSteps/NextSteps'
import { MyDefenses } from '../planning/MyDefenses'
import { StudentsWithoutProject } from '../themes/StudentsWithoutProject'
import { createProject, listProjects } from './api'
import { ProjectForm } from './ProjectForm'
import { tintsFor } from './tints'

export function ProjectListPage() {
  const { t, language } = useLanguage()
  const me = useProfile()
  const navigate = useNavigate()
  const projects = useLoad(listProjects)
  const isAdmin = me.role === 'admin'

  if (!projects.data) return <Loading error={projects.error} />

  const tints = tintsFor(projects.data.map((project) => project.supervisor.id))

  function myPart(project: Project): string | null {
    if (project.supervisor.id === me.id) return t.projects.roleSupervisor
    if (project.jury.some(({ person }) => person.id === me.id)) return t.projects.roleJury
    // The others are the projects of an invitation.
    return isAdmin ? null : t.projects.roleInvited
  }

  return (
    <>
      <h1>{isAdmin ? t.projects.title : t.projects.mine}</h1>
      {!isAdmin && <NextSteps />}

      {isAdmin && (
        <details className="panel">
          <summary>{t.projects.create}</summary>
          <ProjectForm
            onSave={async (input) => navigate(`/projects/${await createProject(input)}`)}
          />
        </details>
      )}

      {isAdmin && <StudentsWithoutProject />}

      {projects.data.length === 0 && <p className="muted">{t.projects.empty}</p>}
      <ul className="project-list">
        {projects.data.map((project) => (
          <li key={project.id} className={tints.get(project.supervisor.id)}>
            <h2>
              <Link to={`/projects/${project.id}`}>{project.title}</Link>
            </h2>
            <p>
              {formatList(language, project.students.map((student) => student.full_name)) ||
                t.projects.noStudents}
              {' · '}
              {t.projects.supervisor} : {project.supervisor.full_name}
            </p>
            <p className="muted">
              {t.status[project.status]}
              {myPart(project) && ` · ${myPart(project)}`}
            </p>
          </li>
        ))}
      </ul>

      {projects.data.length > 0 && !isAdmin && <MyDefenses projects={projects.data} />}
    </>
  )
}
