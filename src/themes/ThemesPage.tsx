import { useState } from 'react'
import { useProfile } from '../auth/AuthContext'
import { ErrorMessage } from '../components/ErrorMessage'
import { Loading } from '../components/Loading'
import { PhaseSwitch } from '../components/PhaseSwitch'
import { useLoad } from '../lib/hooks'
import type { Theme } from '../lib/types'
import { useLanguage } from '../messages/LanguageContext'
import { getSettings, updateSettings } from '../planning/api'
import { listProjects } from '../projects/api'
import { tintsFor } from '../projects/tints'
import { addTheme, listThemes, type ThemeInput } from './api'
import { AskForm } from './AskForm'
import { ReceivedRequests, SentRequests } from './RequestLists'
import { listRequests } from './requests'
import { canAsk, canReview } from './rules'
import { ThemeCard } from './ThemeCard'
import { ThemeForm } from './ThemeForm'
import './themes.css'

export function ThemesPage() {
  const { t } = useLanguage()
  const me = useProfile()
  const page = useLoad(loadPage)

  if (!page.data) return <Loading error={page.error} />
  const { themes, requests, settings, projects } = page.data

  const isStudent = me.role === 'student'
  // A student can only see their own project.
  const mayChoose = isStudent && settings.themes_open && projects.length === 0
  const received = requests.filter(
    ({ status, theme }) => status === 'pending' && theme.professor.id === me.id,
  )

  const isMine = (theme: Theme) => theme.professor.id === me.id || theme.proposed_by === me.id
  const toReview = themes.filter((theme) => canReview(theme, me))
  const mine = themes.filter((theme) => isMine(theme) && !toReview.includes(theme))
  const others = themes.filter((theme) => theme.status === 'open' && !isMine(theme))
  const sections = [
    { title: t.themes.toReview, items: toReview },
    { title: t.themes.mine, items: mine },
    { title: t.themes.catalogue, items: others },
  ]
  const tints = tintsFor(themes.map((theme) => theme.professor.id))

  return (
    <>
      <h1>{t.themes.title}</h1>
      <ErrorMessage error={page.error} />
      <PhaseSwitch
        isOpen={settings.themes_open}
        text={settings.themes_open ? t.themes.phaseOpen : t.themes.phaseClosed}
        onToggle={() => updateSettings({ themes_open: !settings.themes_open })}
        onChange={page.reload}
      />
      {(!isStudent || mayChoose) && <AddTheme onAdded={page.reload} />}

      {isStudent && <SentRequests requests={requests} onChange={page.reload} />}
      <ReceivedRequests requests={received} onChange={page.reload} />

      {sections.every(({ items }) => items.length === 0) && <p className="muted">{t.themes.empty}</p>}
      {sections.map(
        ({ title, items }) =>
          items.length > 0 && (
            <section key={title}>
              <h2>{title}</h2>
              <ul className="theme-list">
                {items.map((theme) => (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    tint={tints.get(theme.professor.id)}
                    onChange={page.reload}
                  >
                    {mayChoose && canAsk(theme, requests) && (
                      <AskForm theme={theme} onAsked={page.reload} />
                    )}
                  </ThemeCard>
                ))}
              </ul>
            </section>
          ),
      )}
    </>
  )
}

async function loadPage() {
  const [themes, requests, settings, projects] = await Promise.all([
    listThemes(),
    listRequests(),
    getSettings(),
    listProjects(),
  ])
  return { themes, requests, settings, projects }
}

function AddTheme({ onAdded }: { onAdded: () => void }) {
  const { t } = useLanguage()
  const me = useProfile()
  const [sent, setSent] = useState(false)

  async function handleSave(input: ThemeInput) {
    await addTheme(input)
    setSent(true)
    onAdded()
  }

  return (
    <details className="panel" onToggle={() => setSent(false)}>
      <summary>{me.role === 'student' ? t.themes.proposeIdea : t.themes.addTheme}</summary>
      <p className="hint">{me.role && t.themes.nextStep[me.role]}</p>
      <ThemeForm
        professorId={me.role === 'supervisor' ? me.id : undefined}
        submitLabel={t.themes.send}
        onSave={handleSave}
      />
      {sent && <p role="status">{t.themes.sent}</p>}
    </details>
  )
}
