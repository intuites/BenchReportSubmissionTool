import { useEffect, useState } from 'react'
import { ShieldCheck, UserCheck, UserPlus, X } from 'lucide-react'
import { confirmDialog } from './Confirm'
import { accountStatus, approveAsRecruiter, displayName, listAccounts, makeAdmin, needsDbUpdate, rejectAccount } from '../lib/access'

// "Waiting for approval" card for admins. Renders nothing for non-admins.
export default function PendingApprovals({ onChange }) {
  const [rows, setRows] = useState(null)
  const [state, setState] = useState('loading') // loading | ok | hidden | update
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  async function load() {
    const { data, error } = await listAccounts()
    if (error) return setState(needsDbUpdate(error) ? 'update' : 'hidden') // not an admin: show nothing
    setRows(data.filter((a) => accountStatus(a) === 'pending'))
    setState('ok')
  }
  useEffect(() => { load() }, [])

  async function act(key, fn, confirmText) {
    if (confirmText && !(await confirmDialog(confirmText.title, confirmText))) return
    setBusy(key)
    setError('')
    const { error } = await fn()
    setBusy('')
    if (error) return setError(error.message)
    await load()
    onChange?.()
  }

  if (state === 'loading' || state === 'hidden') return null
  if (state === 'update') {
    return (
      <div className="card pad approvals">
        <h2><UserPlus size={16} /> Waiting for approval</h2>
        <p className="muted">Approvals need the latest database update. Run <code>supabase/schema.sql</code> in the Supabase SQL Editor, then reload.</p>
      </div>
    )
  }
  if (!rows.length) return null

  return (
    <div className="card approvals">
      <header className="card-head">
        <h2><UserPlus size={16} /> Waiting for approval <span className="nav-badge">{rows.length}</span></h2>
        <span className="muted small">People who signed up and can’t see any data yet</span>
      </header>
      {error && <p className="alert" role="alert" style={{ margin: '0 20px 12px' }}>{error}</p>}
      <table className="table stackable">
        <tbody>
          {rows.map((a) => (
            <tr key={a.user_id}>
              <td><strong>{displayName(a)}</strong><div className="sub">{a.email}</div></td>
              <td className="nowrap mono muted">Signed up {new Date(a.signed_up).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
              <td className="row-actions">
                <button className="btn small accent-text" disabled={!!busy} aria-busy={busy === `r${a.user_id}`} onClick={() => act(`r${a.user_id}`, () => approveAsRecruiter(a))}><UserCheck size={14} /> Approve as recruiter</button>
                <button className="btn small" disabled={!!busy} aria-busy={busy === `a${a.user_id}`} onClick={() => act(`a${a.user_id}`, () => makeAdmin(a))}><ShieldCheck size={14} /> Make admin</button>
                <button className="btn small ghost danger-text" disabled={!!busy} aria-busy={busy === `x${a.user_id}`} onClick={() => act(`x${a.user_id}`, () => rejectAccount(a), { title: 'Reject this sign-up?', body: `The account for ${a.email} will be deleted.`, confirm: 'Reject', cancel: 'Keep' })}><X size={14} /> Reject</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
