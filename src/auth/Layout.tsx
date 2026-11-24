import type { ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router'
import { Header } from '../components/Header'
import { Loading } from '../components/Loading'
import type { Role } from '../lib/types'
import { useLanguage } from '../messages/LanguageContext'
import { NotFoundPage } from '../pages/NotFoundPage'
import { useAuth, useProfile } from './AuthContext'
import { SignInPage } from './SignInPage'
import { SignUpPage } from './SignUpPage'

/** The frame of every page. Decides whether the visitor may go past the sign-in page. */
export function Layout() {
  const { t } = useLanguage()
  const { loading, error, profile } = useAuth()
  const { pathname } = useLocation()

  let content = <Outlet />
  if (loading || error) content = <Loading error={error} />
  else if (!profile) content = pathname === '/signup' ? <SignUpPage /> : <SignInPage />
  else if (!profile.role) {
    content = (
      <div className="narrow">
        <h1>{t.auth.pendingTitle}</h1>
        <p>{t.auth.pendingText}</p>
      </div>
    )
  }

  return (
    <>
      <Header />
      <main>{content}</main>
    </>
  )
}

/** Only hides pages. What a user can really read or change is decided by the database. */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const profile = useProfile()
  return profile.role && roles.includes(profile.role) ? children : <NotFoundPage />
}
