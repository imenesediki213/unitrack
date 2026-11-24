import type { ProjectStatus } from '../lib/types'
import { useLanguage } from '../messages/LanguageContext'

const STEPS: ProjectStatus[] = ['in_progress', 'submitted', 'approved', 'defended']

export function StatusTrack({ status }: { status: ProjectStatus }) {
  const { t } = useLanguage()
  const current = STEPS.indexOf(status)

  return (
    <ol className="status-track">
      {STEPS.map((step, index) => (
        <li
          key={step}
          className={index <= current ? 'reached' : undefined}
          aria-current={index === current ? 'step' : undefined}
        >
          {t.status[step]}
        </li>
      ))}
    </ol>
  )
}
