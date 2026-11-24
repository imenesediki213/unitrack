import { Fragment, useState } from 'react'
import { formatDay, formatTime } from '../messages/format'
import { useLanguage } from '../messages/LanguageContext'
import type { Conflict, Placement } from '../scheduler'
import { cellKey, isAt, type Cell, type PlanningData } from './board'
import { Card } from './Card'
import { groupByDay } from './daySlots'

interface Props {
  data: PlanningData
  /** Past defenses. */
  fixed: Placement[]
  placements: Placement[]
  conflicts: Conflict[]
  selectedId: string | null
  /** Where the selected project would be in conflict. */
  forbiddenCells: Set<string>
  onSelect: (projectId: string | null) => void
  onMove: (projectId: string, target: Cell) => void
}

/** The grid: one row per slot, one column per room. */
export function PlanningBoard(props: Props) {
  const { data, fixed, placements, conflicts, selectedId, forbiddenCells } = props
  const { t, language } = useLanguage()
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)

  const projects = new Map(data.projects.map((project) => [project.id, project]))
  const conflictIds = new Set(conflicts.flatMap((conflict) => conflict.projectIds))

  function renderCell(cell: Cell) {
    const key = cellKey(cell)
    const past = fixed.find((placement) => isAt(placement, cell))
    const placement = past ?? placements.find((item) => isAt(item, cell))
    const project = placement && projects.get(placement.projectId)
    const isForbidden = forbiddenCells.has(key)

    const classes = [
      selectedId && !past && (isForbidden ? 'forbidden' : 'allowed'),
      hoveredKey === key && 'hovered',
    ]

    return (
      <td
        key={key}
        className={classes.filter(Boolean).join(' ')}
        onDragOver={(event) => {
          if (past) return
          // Without this, the browser refuses the drop.
          event.preventDefault()
          setHoveredKey(key)
        }}
        onDragLeave={() => setHoveredKey(null)}
        onDrop={(event) => {
          event.preventDefault()
          setHoveredKey(null)
          const projectId = event.dataTransfer.getData('text/plain')
          // Text dragged from elsewhere also ends up here.
          if (!past && projects.has(projectId)) props.onMove(projectId, cell)
        }}
      >
        {project && (
          <Card
            project={project}
            isSelected={selectedId === project.id}
            hasConflict={conflictIds.has(project.id)}
            onSelect={past ? undefined : props.onSelect}
          />
        )}
        {!project && selectedId && (
          <button
            type="button"
            className="place-button"
            onClick={() => props.onMove(selectedId, cell)}
          >
            {isForbidden ? t.planning.placeHereConflict : t.planning.placeHere}
          </button>
        )}
      </td>
    )
  }

  return (
    <div className="board-scroll">
      <table className="board">
        <thead>
          <tr>
            <th scope="col">{t.planning.slot}</th>
            {data.rooms.map((room) => (
              <th key={room.id} scope="col">
                {room.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groupByDay(data.slots).map(([day, slots]) => (
            <Fragment key={day}>
              <tr className="board-day">
                <th scope="rowgroup" colSpan={data.rooms.length + 1}>
                  <span>{formatDay(language, day)}</span>
                </th>
              </tr>
              {slots.map((slot) => (
                <tr key={slot.id}>
                  <th scope="row">
                    {formatTime(slot.start_time)}
                    <span>{formatTime(slot.end_time)}</span>
                  </th>
                  {data.rooms.map((room) => renderCell({ slotId: slot.id, roomId: room.id }))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
