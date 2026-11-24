import { Link } from 'react-router'
import { useProfile } from '../auth/AuthContext'
import { ErrorMessage } from '../components/ErrorMessage'
import { useLoad } from '../lib/hooks'
import { formatDate, formatDay } from '../messages/format'
import type { Messages } from '../messages/fr'
import type { Language } from '../messages/language'
import { useLanguage } from '../messages/LanguageContext'
import { daysLeft } from '../projects/deadline'
import { loadSteps } from './load'
import type { Step } from './steps'
import './nextSteps.css'

/** Where to go for each step. The others are done on the current page. */
const LINKS: Partial<Record<Step['type'], string>> = {
  chooseTheme: '/themes',
  answerIdeas: '/themes',
  answerRequests: '/themes',
  reviewThemes: '/themes',
  answerInvitations: '/juries',
  confirmJuries: '/juries',
  giveAvailability: '/availability',
  giveRoles: '/people',
  studentsWithoutProject: '/projects',
  markDefended: '/projects',
}

const WAITING: Step['type'][] = [
  'themesClosed',
  'waitRequests',
  'waitReview',
  'waitDefense',
  'waitJury',
  'finished',
]

/** What the user should do now, or what they are waiting for. */
export function NextSteps({ refreshKey = '' }: { refreshKey?: string }) {
  const { t, language } = useLanguage()
  const me = useProfile()
  const steps = useLoad(() => loadSteps(me), refreshKey)

  if (!steps.data) return <ErrorMessage error={steps.error} />
  if (steps.data.length === 0) return null

  return (
    <section className="next-steps" aria-label={t.nextSteps.title}>
      <h2>{t.nextSteps.title}</h2>
      <ul>
        {steps.data.map((step, index) => {
          const link = linkOf(step, me.role === 'student')
          const text = stepText(t, language, step)
          return (
            <li key={index} className={WAITING.includes(step.type) ? 'waiting' : undefined}>
              {link ? <Link to={link}>{text}</Link> : text}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function linkOf(step: Step, isStudent: boolean): string | undefined {
  // Students already are on the page of their project.
  if ('projectId' in step) return isStudent ? undefined : `/projects/${step.projectId}`
  return LINKS[step.type]
}

function stepText(t: Messages, language: Language, step: Step): string {
  switch (step.type) {
    case 'submitReport': {
      if (!step.deadline) return t.nextSteps.submitReport
      const date = formatDate(language, step.deadline)
      return t.nextSteps.submitReportBy(date, daysLeft(step.deadline, new Date()))
    }
    case 'submitChanges':
      return t.nextSteps.submitChanges(step.version)
    case 'prepareDefense':
      return t.nextSteps.prepareDefense(formatDay(language, step.day))
    case 'reviewReport':
    case 'answerMessage':
      return t.nextSteps[step.type](step.title)
    default:
      return 'count' in step ? t.nextSteps[step.type](step.count) : t.nextSteps[step.type]
  }
}
