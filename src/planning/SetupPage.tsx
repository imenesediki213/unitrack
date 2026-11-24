import { useState, type FormEvent } from 'react'
import { ErrorMessage } from '../components/ErrorMessage'
import { Loading } from '../components/Loading'
import { useAction, useLoad } from '../lib/hooks'
import { formatDay, formatTime } from '../messages/format'
import { useLanguage } from '../messages/LanguageContext'
import {
  addRoom,
  addSlots,
  getSettings,
  listRooms,
  listSlots,
  removeRoom,
  removeSlot,
  updateSettings,
} from './api'
import { buildDaySlots, groupByDay } from './daySlots'

export function SetupPage() {
  const { t } = useLanguage()
  return (
    <>
      <h1>{t.setup.title}</h1>
      <Rooms />
      <Slots />
      <Rules />
    </>
  )
}

function Rooms() {
  const { t } = useLanguage()
  const rooms = useLoad(listRooms)
  const { run, busy, error } = useAction()

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const name = String(new FormData(form).get('name')).trim()
    if (await run(() => addRoom(name))) {
      form.reset()
      rooms.reload()
    }
  }

  async function handleRemove(id: string) {
    if (await run(() => removeRoom(id))) rooms.reload()
  }

  return (
    <section>
      <h2>{t.setup.rooms}</h2>
      {!rooms.data && <Loading error={rooms.error} />}
      {rooms.data?.length === 0 && <p className="muted">{t.setup.noRooms}</p>}
      <ul className="people">
        {rooms.data?.map((room) => (
          <li key={room.id}>
            {room.name}
            <button
              type="button"
              className="link-button"
              aria-label={`${t.common.remove} ${room.name}`}
              disabled={busy}
              onClick={() => handleRemove(room.id)}
            >
              {t.common.remove}
            </button>
          </li>
        ))}
      </ul>
      <form className="inline-form" onSubmit={handleAdd}>
        <input
          name="name"
          aria-label={t.setup.roomName}
          placeholder={t.setup.roomName}
          maxLength={60}
          pattern=".*\S.*"
          required
        />
        <button type="submit" disabled={busy}>
          {t.common.add}
        </button>
      </form>
      <ErrorMessage error={error} />
    </section>
  )
}

function Slots() {
  const { t, language } = useLanguage()
  const slots = useLoad(listSlots)
  const { run, busy, error } = useAction()
  const [day, setDay] = useState('')
  const [from, setFrom] = useState('09:00')
  const [to, setTo] = useState('12:00')
  const [minutes, setMinutes] = useState('60')
  const newSlots = buildDaySlots(day, from, to, Number(minutes))

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (await run(() => addSlots(newSlots))) slots.reload()
  }

  async function handleRemove(id: string) {
    if (await run(() => removeSlot(id))) slots.reload()
  }

  return (
    <section>
      <h2>{t.setup.slots}</h2>
      {!slots.data && <Loading error={slots.error} />}
      {slots.data?.length === 0 && <p className="muted">{t.setup.noSlots}</p>}
      {groupByDay(slots.data ?? []).map(([slotDay, daySlots]) => (
        <div key={slotDay}>
          <h3>{formatDay(language, slotDay)}</h3>
          <ul className="slot-list">
            {daySlots.map((slot) => (
              <li key={slot.id}>
                {formatTime(slot.start_time)}–{formatTime(slot.end_time)}
                <button
                  type="button"
                  className="link-button"
                  aria-label={`${t.common.remove} ${formatTime(slot.start_time)}`}
                  disabled={busy}
                  onClick={() => handleRemove(slot.id)}
                >
                  {t.common.remove}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <form className="panel stack" onSubmit={handleAdd}>
        <h3>{t.setup.addDay}</h3>
        <div className="fields">
          <label>
            {t.setup.day}
            <input type="date" value={day} required onChange={(e) => setDay(e.target.value)} />
          </label>
          <label>
            {t.setup.from}
            <input type="time" value={from} required onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            {t.setup.to}
            <input type="time" value={to} required onChange={(e) => setTo(e.target.value)} />
          </label>
          <label>
            {t.setup.minutes}
            <input
              type="number"
              min={5}
              max={480}
              value={minutes}
              required
              onChange={(e) => setMinutes(e.target.value)}
            />
          </label>
        </div>
        <p className="hint">{t.setup.willCreate(newSlots.length)}</p>
        <ErrorMessage error={error} />
        <button type="submit" disabled={busy || newSlots.length === 0}>
          {t.common.add}
        </button>
      </form>
    </section>
  )
}

function Rules() {
  const { t } = useLanguage()
  const settings = useLoad(getSettings)
  const { run, busy, error } = useAction()
  const [saved, setSaved] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const max = Number(new FormData(event.currentTarget).get('max'))
    setSaved(await run(() => updateSettings({ max_defenses_per_day: max })))
  }

  if (!settings.data) return <Loading error={settings.error} />

  return (
    <section>
      <h2>{t.setup.rules}</h2>
      <form className="stack" onSubmit={handleSubmit} onChange={() => setSaved(false)}>
        <label>
          {t.setup.maxPerDay}
          <input
            name="max"
            type="number"
            min={1}
            max={20}
            defaultValue={settings.data.max_defenses_per_day}
            required
          />
        </label>
        <ErrorMessage error={error} />
        <div className="actions">
          <button type="submit" disabled={busy}>
            {t.common.save}
          </button>
          {saved && <span role="status">{t.planning.saved}</span>}
        </div>
      </form>
    </section>
  )
}
