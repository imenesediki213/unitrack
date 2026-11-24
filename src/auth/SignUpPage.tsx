import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ErrorMessage } from '../components/ErrorMessage'
import { useAction } from '../lib/hooks'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../messages/LanguageContext'

export function SignUpPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { run, busy, error } = useAction()
  const [needsConfirmation, setNeedsConfirmation] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)

    void run(async () => {
      const { data, error } = await supabase.auth.signUp({
        email: String(form.get('email')),
        password: String(form.get('password')),
        options: { data: { full_name: String(form.get('fullName')).trim() } },
      })
      if (error) throw error

      // Without a session, the project requires the address to be confirmed first.
      if (data.session) navigate('/')
      else setNeedsConfirmation(true)
    })
  }

  return (
    <div className="narrow">
      <p className="tagline">{t.auth.tagline}</p>
      <h1>{t.auth.signUp}</h1>
      {needsConfirmation ? (
        <p role="status">{t.auth.checkEmail}</p>
      ) : (
        <form className="stack" onSubmit={handleSubmit}>
          <label>
            {t.auth.fullName}
            <input name="fullName" autoComplete="name" maxLength={100} required pattern=".*\S.*" />
          </label>
          <label>
            {t.auth.email}
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            {t.auth.password}
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
            <span className="hint">{t.auth.passwordHint}</span>
          </label>
          <ErrorMessage error={error} />
          <button type="submit" className="primary" disabled={busy}>
            {t.auth.signUp}
          </button>
        </form>
      )}
      <p>
        {t.auth.hasAccount} <Link to="/">{t.auth.signIn}</Link>
      </p>
    </div>
  )
}
