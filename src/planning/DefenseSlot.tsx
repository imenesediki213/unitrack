import { useProfile } from '../auth/AuthContext'
import { ErrorMessage } from '../components/ErrorMessage'
import { useAction, useLoad } from '../lib/hooks'
import type { Project } from '../lib/types'
import { formatDay, formatTime } from '../messages/format'
import { useLanguage } from '../messages/LanguageContext'
import { markDefended } from '../projects/api'
import { listDefenses, listRooms, listSlots } from './api'

interface Props {
  project: Project
  onDefended: () => void
}

/** When and where a project is defended, if the user may know it. */
export function DefenseSlot({ project, onDefended }: Props) {
  const { t, language } = useLanguage()
  const me = useProfile()
  const { run, busy, error } = useAction()
  const schedule = useLoad(() => Promise.all([listDefenses(), listSlots(), listRooms()]))

  const isScheduled = project.status === 'approved' || project.status === 'defended'
  if (!isScheduled || (!schedule.data && !schedule.error)) return null

  const [defenses = [], slots = [], rooms = []] = schedule.data ?? []
  const defense = defenses.find((item) => item.project_id === project.id)
  const slot = slots.find((item) => item.id === defense?.slot_id)
  const room = rooms.find((item) => item.id === defense?.room_id)

  async function handleDefended() {
    if (!window.confirm(t.defense.confirmDefended)) return
    if (await run(() => markDefended(project.id))) onDefended()
  }

  return (
    <section className="defense">
      <h2>{t.defense.title}</h2>
      <ErrorMessage error={schedule.error ?? error} />
      {slot && room ? (
        <>
          <p className="defense-when">
            {t.defense.when(
              formatDay(language, slot.day),
              formatTime(slot.start_time),
              formatTime(slot.end_time),
            )}
          </p>
          <p>{t.defense.room(room.name)}</p>
          {me.role === 'admin' && project.status === 'approved' && (
            <button type="button" disabled={busy} onClick={handleDefended}>
              {t.defense.markDefended}
            </button>
          )}
        </>
      ) : (
        <p className="muted">{t.defense.notScheduled}</p>
      )}
    </section>
  )
}
