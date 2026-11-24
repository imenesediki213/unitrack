import { useState } from 'react'
import { useAction } from '../lib/hooks'
import { useLanguage } from '../messages/LanguageContext'
import { ErrorMessage } from './ErrorMessage'

interface Props {
  onAnswer: (accepted: boolean, reason: string | null) => Promise<unknown>
  onDone: () => void
}

/** Accept, or refuse with a reason. */
export function AnswerForm({ onAnswer, onDone }: Props) {
  const { t } = useLanguage()
  const { run, busy, error } = useAction()
  const [reason, setReason] = useState('')

  async function answer(accepted: boolean) {
    if (await run(() => onAnswer(accepted, accepted ? null : reason.trim()))) onDone()
  }

  return (
    <div className="stack">
      <label>
        {t.answers.reasonLabel}
        <input
          value={reason}
          maxLength={1000}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <div className="actions">
        <button type="button" className="primary" disabled={busy} onClick={() => answer(true)}>
          {t.answers.accept}
        </button>
        <button
          type="button"
          disabled={busy || reason.trim() === ''}
          onClick={() => answer(false)}
        >
          {t.answers.refuse}
        </button>
      </div>
      <ErrorMessage error={error} />
    </div>
  )
}
