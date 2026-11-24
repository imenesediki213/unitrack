import { createBrowserRouter, RouterProvider } from 'react-router'
import { AuthProvider, useProfile } from './auth/AuthContext'
import { Layout, RequireRole } from './auth/Layout'
import { AvailabilityPage } from './availability/AvailabilityPage'
import { LanguageProvider } from './messages/LanguageContext'
import { CrashPage } from './pages/CrashPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PeoplePage } from './people/PeoplePage'
import { PlanningPage } from './planning/PlanningPage'
import { SetupPage } from './planning/SetupPage'
import { ProjectListPage } from './projects/ProjectListPage'
import { ProjectPage, StudentHomePage } from './projects/ProjectPage'

const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <CrashPage />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/projects/:id', element: <ProjectPage /> },
      {
        path: '/projects',
        element: (
          <RequireRole roles={['admin']}>
            <ProjectListPage />
          </RequireRole>
        ),
      },
      {
        path: '/people',
        element: (
          <RequireRole roles={['admin']}>
            <PeoplePage />
          </RequireRole>
        ),
      },
      {
        path: '/setup',
        element: (
          <RequireRole roles={['admin']}>
            <SetupPage />
          </RequireRole>
        ),
      },
      {
        path: '/availability',
        element: (
          <RequireRole roles={['supervisor', 'admin']}>
            <AvailabilityPage />
          </RequireRole>
        ),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

function HomePage() {
  const { role } = useProfile()
  if (role === 'admin') return <PlanningPage />
  if (role === 'supervisor') return <ProjectListPage />
  return <StudentHomePage />
}

export function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </LanguageProvider>
  )
}
