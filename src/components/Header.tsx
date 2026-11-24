import { Link, NavLink, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { useLanguage } from '../messages/LanguageContext'
import { ThemeSwitch } from '../theme/ThemeSwitch'
import { Logo } from './Logo'

export function Header() {
  const { t, language, setLanguage } = useLanguage()
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  function handleSignOut() {
    signOut()
    // The next person to sign in may have no access to the current page.
    navigate('/')
  }

  return (
    <header className="masthead">
      <div className="masthead-top">
        <Link to="/" className="brand">
          <Logo />
          UniTrack
        </Link>
        <div className="masthead-tools">
          <div className="language-switch" role="group" aria-label={t.nav.language}>
            {(['fr', 'en'] as const).map((code) => (
              <button
                key={code}
                type="button"
                lang={code}
                aria-pressed={language === code}
                onClick={() => setLanguage(code)}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
          <ThemeSwitch />
          {profile && (
            <>
              <span className="muted">{profile.full_name}</span>
              <button type="button" className="link-button" onClick={handleSignOut}>
                {t.nav.signOut}
              </button>
            </>
          )}
        </div>
      </div>

      {profile?.role === 'admin' && (
        <nav className="main-nav">
          <NavLink to="/">{t.nav.planning}</NavLink>
          <NavLink to="/themes">{t.nav.themes}</NavLink>
          <NavLink to="/projects">{t.nav.projects}</NavLink>
          <NavLink to="/juries">{t.nav.juries}</NavLink>
          <NavLink to="/results">{t.nav.results}</NavLink>
          <NavLink to="/people">{t.nav.people}</NavLink>
          <NavLink to="/setup">{t.nav.setup}</NavLink>
          <NavLink to="/availability">{t.nav.availability}</NavLink>
        </nav>
      )}
      {profile?.role === 'supervisor' && (
        <nav className="main-nav">
          <NavLink to="/">{t.nav.projects}</NavLink>
          <NavLink to="/themes">{t.nav.themes}</NavLink>
          <NavLink to="/juries">{t.nav.juries}</NavLink>
          <NavLink to="/availability">{t.nav.availability}</NavLink>
        </nav>
      )}
      {profile?.role === 'student' && (
        <nav className="main-nav">
          <NavLink to="/">{t.nav.myProject}</NavLink>
          <NavLink to="/themes">{t.nav.themes}</NavLink>
        </nav>
      )}
    </header>
  )
}
