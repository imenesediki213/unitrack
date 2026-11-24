import { useState } from 'react'
import { useProfile } from '../auth/AuthContext'
import { ErrorMessage } from '../components/ErrorMessage'
import { Loading } from '../components/Loading'
import { useAction, useLoad } from '../lib/hooks'
import { formatDay, formatTime } from '../messages/format'
import { useLanguage } from '../messages/LanguageContext'
import { listPeople } from '../people/api'
import { listSlots } from '../planning/api'
import { groupByDay } from '../planning/daySlots'
import { listAvailableSlots, setAvailable } from './api'

export function AvailabilityPage() {
  const { t } = useLanguage()
  const me = useProfile()
  const isAdmin = me.role === 'admin'
  const [professorId, setProfessorId] = useState(me.id)

  return (
    <>
      <h1>{t.availability.title}</h1>
      <p>{isAdmin ? t.availability.adminIntro : t.availability.intro}</p>
      {isAdmin && <ProfessorSelect value={professorId} onChange={setProfessorId} />}
      <SlotChoices key={professorId} professorId={professorId} />
    </>
  )
}

interface ProfessorSelectProps {
  value: string
  onChange: (professorId: string) => void
}

function ProfessorSelect({ value, onChange }: ProfessorSelectProps) {
  const { t } = useLanguage()
  const professors = useLoad(() => listPeople(['supervisor', 'admin']))

  if (!professors.data) return <Loading error={professors.error} />

  return (
    <label className="narrow-field">
      {t.projects.person}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {professors.data.map((person) => (
          <option key={person.id} value={person.id}>
            {person.full_name}
          </option>
        ))}
      </select>
    </label>
  )
}

function SlotChoices({ professorId }: { professorId: string }) {
  const { t, language } = useLanguage()
  const slots = useLoad(listSlots)
  const available = useLoad(() => listAvailableSlots(professorId))
  const { run, busy, error } = useAction()

  async function toggle(slotId: string, isAvailable: boolean) {
    await run(() => setAvailable(professorId, slotId, isAvailable))
    available.reload()
  }

  if (!slots.data || !available.data) return <Loading error={slots.error ?? available.error} />
  if (slots.data.length === 0) return <p className="muted">{t.availability.noSlots}</p>
  const chosen = available.data

  return (
    <>
      <ErrorMessage error={error ?? available.error} />
      {groupByDay(slots.data).map(([day, daySlots]) => (
        <section key={day}>
          <h2>{formatDay(language, day)}</h2>
          <div className="slot-choices">
            {daySlots.map((slot) => {
              const isAvailable = chosen.has(slot.id)
              return (
                <button
                  key={slot.id}
                  type="button"
                  className="slot-choice"
                  aria-pressed={isAvailable}
                  disabled={busy}
                  onClick={() => toggle(slot.id, !isAvailable)}
                >
                  {formatTime(slot.start_time)}–{formatTime(slot.end_time)}
                  <span>
                    {isAvailable ? t.availability.available : t.availability.unavailable}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </>
  )
}
