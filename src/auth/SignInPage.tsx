import { type FormEvent } from 'react'
import { Link } from 'react-router'
import { ErrorMessage } from '../components/ErrorMessage'
import { useAction } from '../lib/hooks'
import { supabase, unwrap } from '../lib/supabase'
import { useLanguage } from '../messages/LanguageContext'

export function SignInPage() {
  const { t } = useLanguage()
  const { run, busy, error } = useAction()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email'))
    const password = String(form.get('password'))
    void run(() => unwrap(supabase.auth.signInWithPassword({ email, password })))
  }

  return (
    <div className="narrow">
      <p className="tagline">{t.auth.tagline}</p>
      <h1>{t.auth.signIn}</h1>
      <form className="stack" onSubmit={handleSubmit}>
        <label>
          {t.auth.email}
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          {t.auth.password}
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <ErrorMessage error={error} />
        <button type="submit" className="primary" disabled={busy}>
          {t.auth.signIn}
        </button>
      </form>
      <p>
        {t.auth.noAccount} <Link to="/signup">{t.auth.signUp}</Link>
      </p>
    </div>
  )
}
