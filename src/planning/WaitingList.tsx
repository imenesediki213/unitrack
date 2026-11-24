import type { Project } from '../lib/types'
import { useLanguage } from '../messages/LanguageContext'
import type { Placement } from '../scheduler'
import { Card } from './Card'

interface Props {
  projects: Project[]
  placements: Placement[]
  selectedId: string | null
  onSelect: (projectId: string | null) => void
  onRemove: (projectId: string) => void
}

/** Approved projects without a slot. Dropping a card here takes it off the board. */
export function WaitingList({ projects, placements, selectedId, onSelect, onRemove }: Props) {
  const { t } = useLanguage()
  const placedIds = new Set(placements.map((placement) => placement.projectId))
  const approved = projects.filter((project) => project.status === 'approved')
  const waiting = approved.filter((project) => !placedIds.has(project.id))

  return (
    <div
      className="waiting-list"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        onRemove(event.dataTransfer.getData('text/plain'))
      }}
    >
      {waiting.length === 0 && (
        <p className="muted">
          {approved.length === 0 ? t.planning.noApproved : t.planning.allPlaced}
        </p>
      )}
      {waiting.map((project) => (
        <Card
          key={project.id}
          project={project}
          isSelected={selectedId === project.id}
          onSelect={onSelect}
        />
      ))}
      {selectedId && placedIds.has(selectedId) && (
        <button type="button" onClick={() => onRemove(selectedId)}>
          {t.planning.unplace}
        </button>
      )}
    </div>
  )
}
