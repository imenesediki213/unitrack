import type { FormEvent } from 'react'
import { useProfile } from '../auth/AuthContext'
import { ErrorMessage } from '../components/ErrorMessage'
import { useAction, useLoad } from '../lib/hooks'
import type { JuryLoad, JuryRole, Person, Project } from '../lib/types'
import { useLanguage } from '../messages/LanguageContext'
import { listPeople } from '../people/api'
import { getSettings } from '../planning/api'
import { inviteToJury, listInvitations, listJuryLoads, removeInvitation } from './api'
import { professorsToInvite, rolesToInvite } from './rules'

interface Props {
  project: Project
  onChange: () => void
}

/** The invitations of one project, for its students, its supervisor and the admin. */
export function ProjectInvitations({ project, onChange }: Props) {
  const { t } = useLanguage()
  const me = useProfile()
  // Choosing a member directly also settles their invitation, so a new jury reloads the list.
  const juryIds = project.jury.map(({ person }) => person.id)
  const page = useLoad(loadPage, [project.id, ...juryIds].join())
  const { run, busy, error } = useAction()

  const isTeam =
    project.supervisor.id === me.id || project.students.some((student) => student.id === me.id)
  if (!isTeam && me.role !== 'admin') return null
  if (!page.data) return <ErrorMessage error={page.error} />

  const { settings, professors, loads } = page.data
  const invitations = page.data.invitations.filter((item) => item.project_id === project.id)
  // Confirmed professors are already listed in the jury.
  const shown = invitations.filter(
    ({ status }) => status !== 'confirmed' && status !== 'cancelled',
  )

  async function change(action: () => Promise<unknown>) {
    const succeeded = await run(action)
    page.reload()
    if (succeeded) onChange()
    return succeeded
  }

  return (
    <>
      {shown.length > 0 && <h3>{t.juries.invitations}</h3>}
      <ul className="people">
        {shown.map((invitation) => (
          <li key={invitation.id}>
            {invitation.professor.full_name}
            <span className="muted">
              {t.projects[invitation.jury_role]} · {t.juries.status[invitation.status]}
            </span>
            {((isTeam && invitation.status === 'pending') || me.role === 'admin') && (
              <button
                type="button"
                className="link-button"
                aria-label={`${t.juries.withdraw} ${invitation.professor.full_name}`}
                disabled={busy}
                onClick={() => change(() => removeInvitation(invitation.id))}
              >
                {t.juries.withdraw}
              </button>
            )}
            {invitation.reply && <p className="hint">{t.answers.reason(invitation.reply)}</p>}
          </li>
        ))}
      </ul>
      {isTeam &&
        project.status !== 'defended' &&
        (settings.jury_open ? (
          <InviteForm
            professors={professorsToInvite(professors, project, invitations)}
            roles={rolesToInvite(project, invitations)}
            loads={loads}
            busy={busy}
            onInvite={(professorId, role) =>
              change(() => inviteToJury(project.id, professorId, role))
            }
          />
        ) : (
          <p className="hint">{t.juries.phaseClosed}</p>
        ))}
      <ErrorMessage error={error ?? page.error} />
    </>
  )
}

async function loadPage() {
  const [invitations, settings, professors, loads] = await Promise.all([
    listInvitations(),
    getSettings(),
    listPeople(['supervisor', 'admin']),
    listJuryLoads(),
  ])
  return { invitations, settings, professors, loads }
}

interface InviteFormProps {
  professors: Person[]
  roles: JuryRole[]
  loads: JuryLoad[]
  busy: boolean
  onInvite: (professorId: string, role: JuryRole) => Promise<boolean>
}

function InviteForm({ professors, roles, loads, busy, onInvite }: InviteFormProps) {
  const { t } = useLanguage()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    const invited = await onInvite(
      String(values.get('professor')),
      String(values.get('role')) as JuryRole,
    )
    if (invited) form.reset()
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit}>
      <select name="professor" aria-label={t.juries.professor} required>
        <option value="">{t.juries.chooseProfessor}</option>
        {professors.map((professor) => {
          const load = loads.find((item) => item.professor_id === professor.id)
          return (
            <option key={professor.id} value={professor.id}>
              {professor.full_name} ({t.juries.count(load?.confirmed ?? 0)})
            </option>
          )
        })}
      </select>
      <select name="role" aria-label={t.projects.juryRole}>
        {roles.map((role) => (
          <option key={role} value={role}>
            {t.projects[role]}
          </option>
        ))}
      </select>
      <button type="submit" disabled={busy}>
        {t.juries.invite}
      </button>
    </form>
  )
}
