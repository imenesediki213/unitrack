import { Link } from 'react-router'
import { useLanguage } from '../messages/LanguageContext'
import { ConflictPuzzle } from './ConflictPuzzle'
import './landing.css'

/** What visitors see before they sign in. */
export function LandingPage() {
  const { t } = useLanguage()

  return (
    <>
      <div className="hero">
        <div>
          <h1>{t.landing.title}</h1>
          <p className="tagline">{t.landing.intro}</p>
          <div className="actions">
            <Link to="/signup" className="button primary">
              {t.auth.signUp}
            </Link>
            <Link to="/login" className="button">
              {t.auth.signIn}
            </Link>
          </div>
        </div>
        <ConflictPuzzle />
      </div>

      <ul className="landing-roles">
        <li className="tint-0">
          <h2>{t.roles.student}</h2>
          <p>{t.landing.studentText}</p>
        </li>
        <li className="tint-2">
          <h2>{t.roles.supervisor}</h2>
          <p>{t.landing.supervisorText}</p>
        </li>
        <li className="tint-3">
          <h2>{t.roles.admin}</h2>
          <p>{t.landing.adminText}</p>
        </li>
      </ul>
    </>
  )
}
