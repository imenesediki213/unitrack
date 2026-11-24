import { Link } from 'react-router'
import { Loading } from '../components/Loading'
import { useLoad } from '../lib/hooks'
import type { Project } from '../lib/types'
import { formatDay, formatTime } from '../messages/format'
import { useLanguage } from '../messages/LanguageContext'
import { supervisorTints } from '../projects/tints'
import { listDefenses, listRooms, listSlots } from './api'

/** The published defenses of a professor, in chronological order. */
export function MyDefenses({ projects }: { projects: Project[] }) {
  const { t, language } = useLanguage()
  const schedule = useLoad(() => Promise.all([listDefenses(), listSlots(), listRooms()]))

  if (!schedule.data) return <Loading error={schedule.error} />
  const [defenses, slots, rooms] = schedule.data
  const tints = supervisorTints(projects)

  // The slots are already sorted, so following them sorts the defenses.
  const rows = slots.flatMap((slot) =>
    defenses
      .filter((defense) => defense.slot_id === slot.id)
      .map((defense) => ({
        slot,
        room: rooms.find((room) => room.id === defense.room_id),
        project: projects.find((project) => project.id === defense.project_id),
      })),
  )

  return (
    <section>
      <h2>{t.defense.mine}</h2>
      {rows.length === 0 && <p className="muted">{t.defense.noneYet}</p>}
      <ul className="project-list">
        {rows.map(({ slot, room, project }) => (
          <li
            key={project?.id ?? slot.id}
            className={project && tints.get(project.supervisor.id)}
          >
            <p className="defense-when">
              {t.defense.when(
                formatDay(language, slot.day),
                formatTime(slot.start_time),
                formatTime(slot.end_time),
              )}
            </p>
            <p>
              {project && <Link to={`/projects/${project.id}`}>{project.title}</Link>}
              {room && ` · ${room.name}`}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
