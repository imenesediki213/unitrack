import { useProfile } from '../auth/AuthContext'
import { useAction } from '../lib/hooks'
import { useLanguage } from '../messages/LanguageContext'
import { ErrorMessage } from './ErrorMessage'

interface Props {
  isOpen: boolean
  text: string
  onToggle: () => Promise<unknown>
  onChange: () => void
}

/** Says whether a period is open. The admin can open and close it. */
export function PhaseSwitch({ isOpen, text, onToggle, onChange }: Props) {
  const { t } = useLanguage()
  const me = useProfile()
  const { run, busy, error } = useAction()

  async function handleToggle() {
    if (await run(onToggle)) onChange()
  }

  return (
    <>
      <div className="phase actions">
        <span className="muted">{text}</span>
        {me.role === 'admin' && (
          <button type="button" disabled={busy} onClick={handleToggle}>
            {isOpen ? t.common.closePhase : t.common.openPhase}
          </button>
        )}
      </div>
      <ErrorMessage error={error} />
    </>
  )
}
