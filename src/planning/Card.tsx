import type { KeyboardEvent } from 'react'
import type { Project } from '../lib/types'
import { formatList } from '../messages/format'
import { useLanguage } from '../messages/LanguageContext'

interface Props {
  project: Project
  /** The class that gives the colour of the supervisor. */
  tint?: string
  isSelected?: boolean
  hasConflict?: boolean
  /** Left out for past defenses, which cannot move. */
  onSelect?: (projectId: string | null) => void
}

export function Card({ project, tint, isSelected = false, hasConflict = false, onSelect }: Props) {
  const { t, language } = useLanguage()
  const classes = [
    'card',
    tint,
    isSelected && 'selected',
    hasConflict && 'conflict',
    !onSelect && 'fixed',
  ]

  const content = (
    <>
      {hasConflict && <span className="card-tag">{t.planning.conflictTag}</span>}
      {!onSelect && <span className="card-tag">{t.planning.defendedTag}</span>}
      <strong>{project.title}</strong>
      <span>{formatList(language, project.students.map((student) => student.full_name))}</span>
      <span>
        {[project.supervisor, ...project.jury.map(({ person }) => person)]
          .map((person) => person.full_name)
          .join(' · ')}
      </span>
    </>
  )

  if (!onSelect) return <div className={classes.filter(Boolean).join(' ')}>{content}</div>

  const toggle = () => onSelect(isSelected ? null : project.id)

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    toggle()
  }

  // Not a <button>: Firefox does not let buttons be dragged.
  return (
    <div
      className={classes.filter(Boolean).join(' ')}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      draggable
      onClick={toggle}
      onKeyDown={handleKeyDown}
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', project.id)
        event.dataTransfer.effectAllowed = 'move'
        // Chrome cancels the drag if the page changes before this event is over.
        setTimeout(() => onSelect(project.id))
      }}
      onDragEnd={() => onSelect(null)}
    >
      {content}
    </div>
  )
}
