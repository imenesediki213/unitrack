import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useProfile } from '../auth/AuthContext'
import { ErrorMessage } from '../components/ErrorMessage'
import { Loading } from '../components/Loading'
import { useAction, useLoad } from '../lib/hooks'
import type { Project } from '../lib/types'
import { useLanguage } from '../messages/LanguageContext'
import { DefenseSlot } from '../planning/DefenseSlot'
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
  const { t } = useLanguage()
  const projects = useLoad(listProjects)

  if (!projects.data) return <Loading error={projects.error} />

  const project = projects.data[0]
  if (!project) return <p className="muted">{t.projects.noneAssigned}</p>
  return <ProjectDetails project={project} onChange={projects.reload} />
}

function ProjectDetails({ project, onChange }: { project: Project; onChange: () => void }) {
  const me = useProfile()
  const isAdmin = me.role === 'admin'
  const canEdit = isAdmin && project.status !== 'defended'

  return (
    <article className="project">
      <h1>{project.title}</h1>
      <StatusTrack status={project.status} />
      {canEdit && <AdminTools project={project} onChange={onChange} />}
      <DefenseSlot project={project} onDefended={onChange} />
      <Team project={project} canEdit={canEdit} onChange={onChange} />
      <ReportSection project={project} onChange={onChange} />
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
