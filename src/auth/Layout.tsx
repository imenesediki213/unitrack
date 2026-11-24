import type { ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router'
import { Header } from '../components/Header'
import { Loading } from '../components/Loading'
import { LandingPage } from '../landing/LandingPage'
import type { Role } from '../lib/types'
import { useLanguage } from '../messages/LanguageContext'
import { NotFoundPage } from '../pages/NotFoundPage'
import { useAuth, useProfile } from './AuthContext'
import { SignInPage } from './SignInPage'
import { SignUpPage } from './SignUpPage'

/** The frame of every page. Decides what a visitor who is not signed in can see. */
export function Layout() {
  const { t } = useLanguage()
  const { loading, error, profile } = useAuth()
  const { pathname } = useLocation()

  let content = <Outlet />
  if (loading || error) content = <Loading error={error} />
  else if (!profile) content = <SignedOutPage pathname={pathname} />
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

function SignedOutPage({ pathname }: { pathname: string }) {
  if (pathname === '/') return <LandingPage />
  if (pathname === '/signup') return <SignUpPage />
  // Also for links to a page of the app: it opens once the visitor is signed in.
  return <SignInPage />
}

/** Only hides pages. What a user can really read or change is decided by the database. */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const profile = useProfile()
  return profile.role && roles.includes(profile.role) ? children : <NotFoundPage />
}
