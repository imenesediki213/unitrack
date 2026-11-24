import { useProfile } from '../auth/AuthContext'
import { ErrorMessage } from '../components/ErrorMessage'
import { Loading } from '../components/Loading'
import { useAction, useLoad } from '../lib/hooks'
import type { Role } from '../lib/types'
import { useLanguage } from '../messages/LanguageContext'
import { listAccounts, setRole } from './api'

const ROLES: Role[] = ['student', 'supervisor', 'admin']

export function PeoplePage() {
  const { t } = useLanguage()
  const me = useProfile()
  const accounts = useLoad(listAccounts)
  const { run, busy, error } = useAction()

  async function changeRole(id: string, value: string) {
    await run(() => setRole(id, value === '' ? null : (value as Role)))
    accounts.reload()
  }

  if (!accounts.data) return <Loading error={accounts.error} />

  return (
    <>
      <h1>{t.people.title}</h1>
      <p>{t.people.intro}</p>
      <ErrorMessage error={error} />
      <div className="table-scroll">
        <table className="ledger">
          <thead>
            <tr>
              <th>{t.people.name}</th>
              <th>{t.people.email}</th>
              <th>{t.people.role}</th>
            </tr>
          </thead>
          <tbody>
            {accounts.data.map((account) => (
              <tr key={account.id}>
                <td>{account.full_name}</td>
                <td>{account.email}</td>
                <td>
                  {account.id === me.id ? (
                    `${t.roles.admin} (${t.people.you})`
                  ) : (
                    <select
                      aria-label={`${t.people.role} : ${account.full_name}`}
                      value={account.role ?? ''}
                      disabled={busy}
                      onChange={(event) => changeRole(account.id, event.target.value)}
                    >
                      <option value="">{t.roles.none}</option>
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {t.roles[role]}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
