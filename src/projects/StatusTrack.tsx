import type { ProjectStatus } from '../lib/types'
import { useLanguage } from '../messages/LanguageContext'

/** Where each step stands on the stem, in a drawing of 640 × 84. */
const STEPS: { status: ProjectStatus; x: number; y: number; tilt: number }[] = [
  { status: 'in_progress', x: 80, y: 70, tilt: 24 },
  { status: 'submitted', x: 240, y: 56, tilt: -20 },
  { status: 'approved', x: 400, y: 66, tilt: 24 },
  { status: 'defended', x: 560, y: 40, tilt: 0 },
]

const LEAF = 'M0 0C-15-9-16-28 0-40 16-28 15-9 0 0z'
const PETAL_ANGLES = [0, 72, 144, 216, 288]

/** The status as a stem that grows: a leaf for each step, a flower for the defense. */
export function StatusTrack({ status }: { status: ProjectStatus }) {
  const { t } = useLanguage()
  const current = STEPS.findIndex((step) => step.status === status)
  const reached = (index: number) => (index <= current ? 'reached' : undefined)

  return (
    <div className="status-track">
      <svg viewBox="0 0 640 84" aria-hidden="true">
        {STEPS.map(({ status: step, x, y, tilt }, index) => {
          const previous = STEPS[index - 1]
          return (
            <g key={step} className={reached(index)}>
              {previous && (
                <path
                  d={`M${previous.x} ${previous.y}C${previous.x + 70} ${previous.y} ${x - 70} ${y} ${x} ${y}`}
                />
              )}
              <g transform={`translate(${x} ${y}) rotate(${tilt})`}>
                {step === 'defended' ? (
                  PETAL_ANGLES.map((angle) => (
                    <circle key={angle} cy="-12" r="11" transform={`rotate(${angle})`} />
                  ))
                ) : (
                  <path className="status-leaf" d={LEAF} />
                )}
              </g>
            </g>
          )
        })}
      </svg>
      <ol>
        {STEPS.map(({ status: step }, index) => (
          <li
            key={step}
            className={reached(index)}
            aria-current={index === current ? 'step' : undefined}
          >
            {t.status[step]}
          </li>
        ))}
      </ol>
    </div>
  )
}
