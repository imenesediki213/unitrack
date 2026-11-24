import { AnswerForm } from '../components/AnswerForm'
import { ErrorMessage } from '../components/ErrorMessage'
import { useAction } from '../lib/hooks'
import type { ThemeRequest } from '../lib/types'
import { useLanguage } from '../messages/LanguageContext'
import { answerRequest, withdrawRequest } from './requests'
import './themes.css'

interface Props {
  requests: ThemeRequest[]
  onChange: () => void
}

/** What a student asked for, and the answers. */
export function SentRequests({ requests, onChange }: Props) {
  const { t } = useLanguage()
  if (requests.length === 0) return null

  return (
    <section>
      <h2>{t.requests.mine}</h2>
      <ul className="request-list">
        {requests.map((request) => (
          <SentRequest key={request.id} request={request} onChange={onChange} />
        ))}
      </ul>
    </section>
  )
}

function SentRequest({ request, onChange }: { request: ThemeRequest; onChange: () => void }) {
  const { t } = useLanguage()
  const { run, busy, error } = useAction()

  async function handleWithdraw() {
    if (await run(() => withdrawRequest(request.id))) onChange()
  }

  return (
    <li className={`request request-${request.status}`}>
      <h3>{request.theme.title}</h3>
      <p>
        {request.theme.professor.full_name}{' '}
        <span className="card-tag">{t.requests.status[request.status]}</span>
      </p>
      {request.reply && <p>{t.answers.reason(request.reply)}</p>}
      {request.status === 'pending' && (
        <button type="button" disabled={busy} onClick={handleWithdraw}>
          {t.requests.withdraw}
        </button>
      )}
      <ErrorMessage error={error} />
    </li>
  )
}

/** The students who wait for a professor's answer. */
export function ReceivedRequests({ requests, onChange }: Props) {
  const { t } = useLanguage()
  if (requests.length === 0) return null

  return (
    <section>
      <h2>{t.requests.received}</h2>
      <p className="hint">{t.requests.acceptNote}</p>
      <ul className="request-list">
        {requests.map((request) => (
          <li key={request.id} className="request">
            <h3>{request.student.full_name}</h3>
            <p>{request.theme.title}</p>
            {request.message && <blockquote>{request.message}</blockquote>}
            <AnswerForm
              onAnswer={(accepted, reason) => answerRequest(request.id, accepted, reason)}
              onDone={onChange}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
