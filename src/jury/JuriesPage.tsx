import { Link } from 'react-router'
import { useProfile } from '../auth/AuthContext'
import { AnswerForm } from '../components/AnswerForm'
import { ErrorMessage } from '../components/ErrorMessage'
import { Loading } from '../components/Loading'
import { PhaseSwitch } from '../components/PhaseSwitch'
import { useAction, useLoad } from '../lib/hooks'
import type { JuryInvitation, JuryLoad, Person, Project } from '../lib/types'
import { formatList } from '../messages/format'
import { useLanguage } from '../messages/LanguageContext'
import { listPeople } from '../people/api'
import { getSettings, updateSettings } from '../planning/api'
import { listProjects } from '../projects/api'
import { isJuryComplete } from '../projects/jury'
import { answerInvitation, confirmJury, listInvitations, listJuryLoads } from './api'
import './jury.css'

/** Invitations for professors. The admin also confirms juries here. */
export function JuriesPage() {
  const { t, language } = useLanguage()
  const me = useProfile()
  const page = useLoad(loadPage)

  if (!page.data) return <Loading error={page.error} />
  const { invitations, projects, settings, professors, loads } = page.data

  const received = invitations.filter(
    ({ professor, status }) => professor.id === me.id && status === 'pending',
  )
  const myLoad = loads.find((load) => load.professor_id === me.id)?.confirmed ?? 0
  const projectsById = new Map(projects.map((project) => [project.id, project]))

  return (
    <>
      <h1>{t.juries.title}</h1>
      <ErrorMessage error={page.error} />
      <PhaseSwitch
        isOpen={settings.jury_open}
        text={settings.jury_open ? t.juries.phaseOpen : t.juries.phaseClosed}
        onToggle={() => updateSettings({ jury_open: !settings.jury_open })}
        onChange={page.reload}
      />

      <section>
        <h2>{t.juries.received}</h2>
        <p className="hint">{t.juries.myLoad(myLoad)}</p>
        {received.length === 0 && <p className="muted">{t.juries.noneReceived}</p>}
        <ul className="invitation-list">
          {received.map((invitation) => {
            const project = projectsById.get(invitation.project_id)
            return (
              <li key={invitation.id} className="invitation">
                <h3>{project?.title}</h3>
                {project && (
                  <p>
                    {formatList(language, project.students.map((student) => student.full_name))}
                    {' · '}
                    {t.projects.supervisor} : {project.supervisor.full_name}
                  </p>
                )}
                {project?.description && <p>{project.description}</p>}
                <p>{t.juries.invitedAs(t.projects[invitation.jury_role])}</p>
                <AnswerForm
                  onAnswer={(accepted, reason) =>
                    answerInvitation(invitation.id, accepted, reason)
                  }
                  onDone={page.reload}
                />
              </li>
            )
          })}
        </ul>
      </section>

      {me.role === 'admin' && (
        <>
          <IncompleteJuries projects={projects} invitations={invitations} onChange={page.reload} />
          <Loads professors={professors} loads={loads} />
        </>
      )}
    </>
  )
}

async function loadPage() {
  const [invitations, projects, settings, professors, loads] = await Promise.all([
    listInvitations(),
    listProjects(),
    getSettings(),
    listPeople(['supervisor', 'admin']),
    listJuryLoads(),
  ])
  return { invitations, projects, settings, professors, loads }
}

interface IncompleteJuriesProps {
  projects: Project[]
  invitations: JuryInvitation[]
  onChange: () => void
}

/** The juries that the admin can confirm or still has to complete. */
function IncompleteJuries({ projects, invitations, onChange }: IncompleteJuriesProps) {
  const { t } = useLanguage()

  const rows = projects
    .filter((project) => project.status !== 'defended')
    .map((project) => ({
      project,
      invitations: invitations.filter(
        ({ project_id, status }) =>
          project_id === project.id && (status === 'pending' || status === 'accepted'),
      ),
    }))
    .filter((row) => row.invitations.length > 0 || !isJuryComplete(row.project.jury))

  return (
    <section>
      <h2>{t.juries.toComplete}</h2>
      {rows.length === 0 && <p className="muted">{t.juries.allComplete}</p>}
      <ul className="invitation-list">
        {rows.map((row) => (
          <IncompleteJury key={row.project.id} {...row} onChange={onChange} />
        ))}
      </ul>
    </section>
  )
}

interface IncompleteJuryProps {
  project: Project
  invitations: JuryInvitation[]
  onChange: () => void
}

function IncompleteJury({ project, invitations, onChange }: IncompleteJuryProps) {
  const { t } = useLanguage()
  const { run, busy, error } = useAction()
  const hasAccepted = invitations.some(({ status }) => status === 'accepted')

  async function handleConfirm() {
    if (await run(() => confirmJury(project.id))) onChange()
  }

  return (
    <li className="invitation">
      <h3>
        <Link to={`/projects/${project.id}`}>{project.title}</Link>
      </h3>
      <ul className="people">
        {project.jury.map(({ person, role }) => (
          <li key={person.id}>
            {person.full_name}
            <span className="muted">
              {t.projects[role]} · {t.juries.status.confirmed}
            </span>
          </li>
        ))}
        {invitations.map((invitation) => (
          <li key={invitation.id}>
            {invitation.professor.full_name}
            <span className="muted">
              {t.projects[invitation.jury_role]} · {t.juries.status[invitation.status]}
            </span>
          </li>
        ))}
      </ul>
      {!isJuryComplete(project.jury) && <p className="hint">{t.projects.incompleteJury}</p>}
      {hasAccepted && (
        <button type="button" className="primary" disabled={busy} onClick={handleConfirm}>
          {t.juries.confirm}
        </button>
      )}
      <ErrorMessage error={error} />
    </li>
  )
}

function Loads({ professors, loads }: { professors: Person[]; loads: JuryLoad[] }) {
  const { t } = useLanguage()

  return (
    <section>
      <h2>{t.juries.loads}</h2>
      <div className="table-scroll">
        <table className="ledger">
          <thead>
            <tr>
              <th scope="col">{t.people.name}</th>
              <th scope="col">{t.juries.confirmed}</th>
              <th scope="col">{t.juries.waiting}</th>
            </tr>
          </thead>
          <tbody>
            {professors.map((professor) => {
              const load = loads.find((item) => item.professor_id === professor.id)
              return (
                <tr key={professor.id}>
                  <td>{professor.full_name}</td>
                  <td>{load?.confirmed ?? 0}</td>
                  <td>{load?.waiting ?? 0}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
