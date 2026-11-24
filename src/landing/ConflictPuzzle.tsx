import { useState } from 'react'
import { useLanguage } from '../messages/LanguageContext'
import { isAt, moveProject, type Cell } from '../planning/board'
import { findConflicts, type Conflict } from '../scheduler'
import { MOVABLE_ID, puzzle, startPlacements } from './puzzle'

/** A tiny planning board. It is checked by the same function as the real one. */
export function ConflictPuzzle() {
  const { t } = useLanguage()
  const [placements, setPlacements] = useState(startPlacements)

  const conflicts = findConflicts(puzzle, placements)
  const conflictIds = new Set(conflicts.flatMap((conflict) => conflict.projectIds))
  const movableTitle = t.landing.puzzleProjects[MOVABLE_ID]

  function move(target: Cell) {
    setPlacements(moveProject(placements, MOVABLE_ID, target))
  }

  function conflictText(conflict: Conflict) {
    // The data of the puzzle allows no other kind of conflict.
    if (conflict.type !== 'personDoubleBooked') return null
    const { personId, projectIds, slotId } = conflict
    return t.conflicts.personDoubleBooked(personId, projectIds.length, slotId)
  }

  function renderCell(cell: Cell) {
    const placement = placements.find((item) => isAt(item, cell))
    const index = puzzle.projects.findIndex((project) => project.id === placement?.projectId)
    const project = puzzle.projects[index]

    if (!project) {
      return (
        <button
          type="button"
          className="puzzle-cell"
          aria-label={t.landing.placeHere(movableTitle, cell.roomId, cell.slotId)}
          onClick={() => move(cell)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            move(cell)
          }}
        >
          {t.planning.placeHere}
        </button>
      )
    }

    const hasConflict = conflictIds.has(project.id)
    const isMovable = project.id === MOVABLE_ID
    const classes = ['card', `tint-${index}`, hasConflict && 'conflict', isMovable && 'movable']

    return (
      <div
        className={classes.filter(Boolean).join(' ')}
        draggable={isMovable}
        // Firefox only starts a drag that carries data.
        onDragStart={(event) => event.dataTransfer.setData('text/plain', project.id)}
      >
        {hasConflict && <span className="card-tag">{t.planning.conflictTag}</span>}
        <strong>{t.landing.puzzleProjects[project.id as keyof typeof t.landing.puzzleProjects]}</strong>
        <span>{project.people.join(' · ')}</span>
      </div>
    )
  }

  return (
    <div className="puzzle">
      <h2>{t.landing.puzzleTitle}</h2>
      <table className="puzzle-board">
        <thead>
          <tr>
            <th scope="col">
              <span className="visually-hidden">{t.planning.slot}</span>
            </th>
            {puzzle.roomIds.map((roomId) => (
              <th key={roomId} scope="col">
                {roomId}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {puzzle.slots.map((slot) => (
            <tr key={slot.id}>
              <th scope="row">{slot.id}</th>
              {puzzle.roomIds.map((roomId) => (
                <td key={roomId}>{renderCell({ slotId: slot.id, roomId })}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="puzzle-message" aria-live="polite">
        {conflicts.map((conflict, index) => (
          <p key={index} className="puzzle-conflict">
            {conflictText(conflict)}
          </p>
        ))}
        {conflicts.length === 0 && <p className="puzzle-solved">{t.landing.solved}</p>}
      </div>
      {conflicts.length > 0 ? (
        <p className="hint">{t.landing.puzzleHint}</p>
      ) : (
        <button type="button" onClick={() => setPlacements(startPlacements)}>
          {t.landing.restart}
        </button>
      )}
    </div>
  )
}
