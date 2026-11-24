import { useLanguage } from '../messages/LanguageContext'
import type { Failure, GenerateResult } from '../scheduler'
import type { Explainer } from './explanations'

interface Props {
  result: GenerateResult
  explainer: Explainer
}

/** What the last generation achieved, or why it failed. */
export function GenerationReport({ result, explainer }: Props) {
  const { t } = useLanguage()

  return (
    <section className="report" aria-live="polite">
      <h2>{t.planning.result}</h2>
      {result.status === 'solved' && <p>{t.planning.solved(result.placements.length)}</p>}

      {result.status === 'impossible' && (
        <>
          <p>{t.planning.impossible}</p>
          <ul className="conflict-list">
            {result.failures.map((failure, index) => (
              <FailureItem key={index} failure={failure} explainer={explainer} />
            ))}
          </ul>
        </>
      )}

      {result.status === 'gaveUp' && (
        <>
          <p>{t.planning.gaveUp}</p>
          <p>{t.planning.busiest}</p>
          <ul>
            {result.busiest.map(({ personId, needed, possible }) => (
              <li key={personId}>
                {t.planning.workload(explainer.person(personId), needed, possible)}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function FailureItem({ failure, explainer }: { failure: Failure; explainer: Explainer }) {
  const { t } = useLanguage()

  return (
    <li>
      {explainer.failure(failure)}
      {failure.type === 'conflictGroup' &&
        (failure.relaxations.length === 0 ? (
          <p className="hint">{t.failures.noRelaxation}</p>
        ) : (
          <>
            <p className="hint">{t.failures.relaxations}</p>
            <ul>
              {failure.relaxations.map((relaxation, index) => (
                <li key={index}>{explainer.relaxation(relaxation)}</li>
              ))}
            </ul>
          </>
        ))}
    </li>
  )
}
