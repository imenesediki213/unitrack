import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useProfile } from '../auth/AuthContext'
import { ErrorMessage } from '../components/ErrorMessage'
import { Loading } from '../components/Loading'
import { Discussion } from '../discussion/Discussion'
import { useAction, useLoad } from '../lib/hooks'
import type { Project } from '../lib/types'
import { useLanguage } from '../messages/LanguageContext'
import { NextSteps } from '../nextSteps/NextSteps'
import { DefenseSlot } from '../planning/DefenseSlot'
import { ResultSection } from '../results/ResultSection'
import { SentRequests } from '../themes/RequestLists'
import { listRequests } from '../themes/requests'
import { deleteProject, getProject, listProjects, updateProject } from './api'
import { ProjectForm } from './ProjectForm'
import { ReportSection } from './ReportSection'
import { StatusTrack } from './StatusTrack'
import { Team } from './Team'

export function ProjectPage() {
  const { id = '' } = useParams()
  const project = useLoad(() => getProject(id), id)

  if (!project.data || project.data.id !== id) return <Loading error={project.error} />
  return <ProjectDetails project={project.data} onChange={project.reload} />
}

/** A student has at most one project, so their home page is that project. */
export function StudentHomePage() {
  const projects = useLoad(listProjects)

  if (!projects.data) return <Loading error={projects.error} />

  const project = projects.data[0]
  if (!project) return <NoProject />
  return <ProjectDetails project={project} onChange={projects.reload} />
}

function NoProject() {
  const { t } = useLanguage()
  const requests = useLoad(listRequests)

  return (
    <>
      <h1>{t.nav.myProject}</h1>
      <StatusTrack status={null} />
      <NextSteps refreshKey={String(requests.data?.length)} />
      <p>{t.projects.noneAssigned}</p>
      <Link to="/themes" className="button primary">
        {t.themes.browse}
      </Link>
      <ErrorMessage error={requests.error} />
      <SentRequests requests={requests.data ?? []} onChange={requests.reload} />
    </>
  )
}

function ProjectDetails({ project, onChange }: { project: Project; onChange: () => void }) {
  const me = useProfile()
  const isStudent = project.students.some((student) => student.id === me.id)
  const isTeam = isStudent || project.supervisor.id === me.id
  const canEdit = me.role === 'admin' && project.status !== 'defended'
  // Every change on this page can change what the student has to do next.
  const [changes, setChanges] = useState(0)

  function handleChange() {
    setChanges((count) => count + 1)
    onChange()
  }

  return (
    <article className="project">
      <h1>{project.title}</h1>
      {project.description && <p>{project.description}</p>}
      <StatusTrack status={project.status} />
      {isStudent && <NextSteps refreshKey={String(changes)} />}
      {canEdit && <AdminTools project={project} onChange={handleChange} />}
      <DefenseSlot project={project} onDefended={handleChange} />
      <ResultSection project={project} onChange={handleChange} />
      <Team project={project} canEdit={canEdit} onChange={handleChange} />
      <ReportSection project={project} onChange={handleChange} />
      {isTeam && <Discussion project={project} onChange={handleChange} />}
    </article>
  )
}

function AdminTools({ project, onChange }: { project: Project; onChange: () => void }) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { run, busy, error } = useAction()
  const [editing, setEditing] = useState(false)

  async function handleDelete() {
    if (!window.confirm(t.projects.confirmDelete)) return
    if (await run(() => deleteProject(project.id))) navigate('/projects')
  }

  return (
    <div className="panel stack">
      <div className="actions">
        <button type="button" aria-expanded={editing} onClick={() => setEditing(!editing)}>
          {t.projects.edit}
        </button>
        <button type="button" className="danger" disabled={busy} onClick={handleDelete}>
          {t.projects.delete}
        </button>
      </div>
      <ErrorMessage error={error} />
      {editing && (
        <ProjectForm
          project={project}
          onSave={async (input) => {
            await updateProject(project.id, input)
            setEditing(false)
            onChange()
          }}
        />
      )}
    </div>
  )
}
