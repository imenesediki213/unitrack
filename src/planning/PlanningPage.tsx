import { useEffect, useMemo, useState } from 'react'
import { Link, useBlocker } from 'react-router'
import { ErrorMessage } from '../components/ErrorMessage'
import { Loading } from '../components/Loading'
import { useAction, useLoad } from '../lib/hooks'
import { useLanguage } from '../messages/LanguageContext'
import { listProjects } from '../projects/api'
import { supervisorTints } from '../projects/tints'
import { findConflicts, generateSchedule, type GenerateResult } from '../scheduler'
import {
  getSettings,
  listDefenses,
  listRooms,
  listSlots,
  loadAvailability,
  saveSchedule,
  updateSettings,
} from './api'
import {
  buildProblem,
  conflictingCells,
  isSameSchedule,
  movablePlacements,
  moveProject,
  removeProject,
  type Cell,
  type PlanningData,
} from './board'
import { PlanningBoard } from './PlanningBoard'
import { createExplainer } from './explanations'
import { GenerationReport } from './GenerationReport'
import { WaitingList } from './WaitingList'
import './planning.css'

export function PlanningPage() {
  const { t } = useLanguage()
  const planning = useLoad(loadPlanning)

  if (!planning.data) return <Loading error={planning.error} />

  if (planning.data.rooms.length === 0 || planning.data.slots.length === 0) {
    return (
      <>
        <h1>{t.planning.title}</h1>
        <p>{t.planning.needsSetup}</p>
        <Link to="/setup">{t.planning.toSetup}</Link>
      </>
    )
  }
  return (
    <>
      <ErrorMessage error={planning.error} />
      <PlanningEditor data={planning.data} onSaved={planning.reload} />
    </>
  )
}

async function loadPlanning(): Promise<PlanningData> {
  const [projects, rooms, slots, availability, defenses, settings] = await Promise.all([
    listProjects(),
    listRooms(),
    listSlots(),
    loadAvailability(),
    listDefenses(),
    getSettings(),
  ])
  return { projects, rooms, slots, availability, defenses, settings }
}

function PlanningEditor({ data, onSaved }: { data: PlanningData; onSaved: () => void }) {
  const { t, language } = useLanguage()
  const { run, busy, error } = useAction()

  const problem = useMemo(() => buildProblem(data), [data])
  const saved = useMemo(() => movablePlacements(data, problem), [data, problem])
  const tints = useMemo(() => supervisorTints(data.projects), [data])
  const explainer = useMemo(() => createExplainer(data, t, language), [data, t, language])

  const [placements, setPlacements] = useState(saved)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<GenerateResult | null>(null)

  const isDirty = !isSameSchedule(placements, saved)
  const conflicts = useMemo(
    () => findConflicts(problem, [...problem.fixed, ...placements]),
    [problem, placements],
  )
  const forbiddenCells = useMemo(
    () => (selectedId ? conflictingCells(problem, placements, selectedId) : new Set<string>()),
    [problem, placements, selectedId],
  )

  useWarnBeforeLeaving(isDirty, t.planning.confirmLeave)

  function handleMove(projectId: string, target: Cell) {
    setPlacements(moveProject(placements, projectId, target))
    setSelectedId(null)
  }

  function handleRemove(projectId: string) {
    setPlacements(removeProject(placements, projectId))
    setSelectedId(null)
  }

  function handleGenerate() {
    if (placements.length > 0 && !window.confirm(t.planning.confirmGenerate)) return
    setGenerating(true)
    setSelectedId(null)

    // The search blocks the page, so the browser gets time to show "Generating…" first.
    setTimeout(() => {
      const generated = generateSchedule(problem)
      if (generated.status === 'solved') setPlacements(generated.placements)
      if (generated.status === 'gaveUp') setPlacements(generated.best)
      setResult(generated)
      setGenerating(false)
    }, 50)
  }

  async function handleSave() {
    const defenses = placements.map(({ projectId, slotId, roomId }) => ({
      project_id: projectId,
      slot_id: slotId,
      room_id: roomId,
    }))
    if (await run(() => saveSchedule(defenses))) onSaved()
  }

  async function handlePublish() {
    const schedule_published = !data.settings.schedule_published
    if (await run(() => updateSettings({ schedule_published }))) onSaved()
  }

  const isPublished = data.settings.schedule_published

  return (
    <>
      <div className="planning-heading">
        <h1>{t.planning.title}</h1>
        <div className="actions">
          <button type="button" disabled={generating || busy} onClick={handleGenerate}>
            {generating ? t.planning.generating : t.planning.generate}
          </button>
          <button
            type="button"
            disabled={!isDirty || busy}
            onClick={() => {
              setPlacements(saved)
              setResult(null)
            }}
          >
            {t.planning.revert}
          </button>
          <button
            type="button"
            className="primary"
            disabled={!isDirty || conflicts.length > 0 || busy}
            onClick={handleSave}
          >
            {t.planning.save}
          </button>
        </div>
      </div>

      <div className="planning-status">
        <span role="status">
          {isDirty && t.planning.unsaved}
          {isDirty && conflicts.length > 0 && ` · ${t.planning.fixConflicts}`}
        </span>
        <span>
          {isPublished ? t.planning.published : t.planning.draft}{' '}
          <button type="button" className="link-button" disabled={busy} onClick={handlePublish}>
            {isPublished ? t.planning.unpublish : t.planning.publish}
          </button>
        </span>
      </div>
      <ErrorMessage error={error} />

      <div className="planning-layout">
        <PlanningBoard
          data={data}
          tints={tints}
          fixed={problem.fixed}
          placements={placements}
          conflicts={conflicts}
          selectedId={selectedId}
          forbiddenCells={forbiddenCells}
          onSelect={setSelectedId}
          onMove={handleMove}
        />

        <aside className="planning-notes">
          <section>
            <h2>{t.planning.unscheduled}</h2>
            <WaitingList
              projects={data.projects}
              tints={tints}
              placements={placements}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onRemove={handleRemove}
            />
            <p className="hint">{t.planning.selectHint}</p>
          </section>

          <section aria-live="polite">
            <h2>{t.planning.conflicts}</h2>
            {conflicts.length === 0 ? (
              <p className="muted">{t.planning.noConflicts}</p>
            ) : (
              <ul className="conflict-list">
                {conflicts.map((conflict, index) => (
                  <li key={index}>{explainer.conflict(conflict)}</li>
                ))}
              </ul>
            )}
          </section>

          {result && <GenerationReport result={result} explainer={explainer} />}
        </aside>
      </div>
    </>
  )
}

/** Covers both ways to lose changes: another page of the app, or closing the tab. */
function useWarnBeforeLeaving(isDirty: boolean, question: string) {
  const blocker = useBlocker(isDirty)

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm(question)) blocker.proceed()
    else blocker.reset()
  }, [blocker, question])

  useEffect(() => {
    if (!isDirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [isDirty])
}
