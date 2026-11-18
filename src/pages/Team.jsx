import { SkeletonRows } from '../components/Loading'
import { useEffect, useState } from 'react'
import { Power, PowerOff, Settings2, ShieldCheck, ShieldOff, Trash2, UserCheck, UserX, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useLive } from '../lib/live'
import { accountStatus, approveAsRecruiter, deleteAccount, displayName, listAccounts, makeAdmin, needsDbUpdate, rejectAccount, removeAccess, removeAdmin, setAccountActive } from '../lib/access'
import MenuButton from '../components/MenuButton'
import Segmented from '../components/Segmented'
import PageHead from '../components/PageHead'
import { confirmDialog } from '../components/Confirm'

// Admins approve sign-ups here: as a recruiter (adds them to the Recruiters
// list, which also makes them eligible for follow-up emails) or as an admin.
export default function Team() {
  const [rows, setRows] = useState(null)
  const [open, setOpen] = useState(null)
  const [filter, setFilter] = useState('pending')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [me, setMe] = useState(null)
  useEffect(() => { supabase.auth.getSession().then(({ data }) => setMe(data.session?.user?.id ?? null)) }, [])

  async function load() {
    const [a, s] = await Promise.all([listAccounts(), supabase.from('bt_settings').select('open_access').eq('id', 1).single()])
    const failed = a.error || s.error
    if (failed) return setError(needsDbUpdate(failed) || /open_access/.test(failed.message) ? 'This page needs the latest database update: run supabase/schema.sql in the Supabase SQL Editor, then reload.' : failed.message)
    setError('')
    setRows(a.data)
    setOpen(s.data.open_access)
  }
  useEffect(() => { load() }, [])
  // another admin approves, removes or deactivates someone: the list updates in place
  useLive(['bt_recruiters', 'bt_admins', 'bt_blocked', 'bt_settings'], load)

  // run one change, then reload the list
  async function act(key, fn, confirmText) {
    if (confirmText && !(await confirmDialog(confirmText.title, confirmText))) return
    setBusy(key)
    setError('')
    const { error } = await fn()
    setBusy('')
    if (error) setError(error.message)
    load()
  }

  // What can be done to one account, depending on where it stands. Never deactivate or delete yourself.
  function manageItems(r, st, self) {
    const items = []
    if (st === 'deactivated') items.push({ id: 'activate', label: 'Activate account', note: 'Give their access back', icon: Power })
    else {
      if (r.is_admin) items.push({ id: 'unadmin', label: 'Remove admin access', note: r.recruiter_active ? 'They stay a recruiter' : 'They lose all access', icon: ShieldOff })
      else items.push({ id: 'admin', label: 'Make admin', note: 'Full access to every page', icon: ShieldCheck })
      if (!r.is_admin && r.recruiter_active) items.push({ id: 'unrecruit', label: 'Remove recruiter access', note: 'Their records stay', icon: UserX })
      if (!self && st !== 'pending' && st !== 'unconfirmed') items.push({ id: 'deactivate', label: 'Deactivate account', note: 'Keep the login, block access', icon: PowerOff })
    }
    if (!self) items.push(st === 'pending' || st === 'unconfirmed'
      ? { id: 'reject', label: 'Reject sign-up', note: 'Deletes this new account', icon: X, danger: true }
      : { id: 'delete', label: 'Delete account', note: 'Their submissions stay', icon: Trash2, danger: true })
    return items
  }
  function manage(id, r) {
    const who = displayName(r)
    const k = (x) => `${x}${r.user_id}`
    if (id === 'activate') return act(k('t'), () => setAccountActive(r, true), { title: `Activate ${who}?`, body: `${r.email} gets their access back.`, confirm: 'Activate', cancel: 'Cancel' })
    if (id === 'deactivate') return act(k('t'), () => setAccountActive(r, false), { title: `Deactivate ${who}?`, body: `${r.email} keeps their login but can't see or change anything until you activate them again. Their records stay.`, confirm: 'Deactivate', cancel: 'Keep active' })
    if (id === 'admin') return act(k('a'), () => makeAdmin(r), { title: `Make ${who} an admin?`, body: 'Admins see every page, approve people, change the follow-up rule and export reports.', confirm: 'Make admin', cancel: 'Cancel' })
    if (id === 'unadmin') return act(k('a'), () => removeAdmin(r), { title: `Remove admin access from ${who}?`, body: r.recruiter_active ? 'They stay a recruiter with normal access.' : 'They are not a recruiter, so they will lose all access.', confirm: 'Remove admin', cancel: 'Keep admin' })
    if (id === 'unrecruit') return act(k('v'), () => removeAccess(r), { title: `Remove ${who}'s access?`, body: `${r.email} will be signed out of the data. Their past submissions stay.`, confirm: 'Remove access', cancel: 'Keep' })
    if (id === 'reject') return act(k('x'), () => rejectAccount(r), { title: 'Reject this sign-up?', body: `The account for ${r.email} will be deleted.`, confirm: 'Reject', cancel: 'Keep' })
    if (id === 'delete') return act(k('x'), () => deleteAccount(r), { title: `Delete ${who}'s account?`, body: `The login for ${r.email} is removed for good. Their submissions and interviews stay, under an inactive recruiter. This cannot be undone.`, confirm: 'Delete account', cancel: 'Keep' })
  }

  const toggleOpen = () => act('open', () => supabase.from('bt_settings').update({ open_access: !open }).eq('id', 1))

  const counts = { pending: 0, approved: 0, unconfirmed: 0, deactivated: 0 }
  rows?.forEach((r) => counts[accountStatus(r)]++)
  const shown = rows?.filter((r) => filter === 'all' || accountStatus(r) === filter) ?? []

  return (
    <section className="page">
      <PageHead title="Team access" subtitle="Approve or reject people who signed up">
        <Segmented
          label="Filter accounts"
          value={filter}
          onChange={setFilter}
          items={[['pending', `Waiting ${counts.pending}`], ['approved', `Approved ${counts.approved}`], ['unconfirmed', `Unconfirmed ${counts.unconfirmed}`], ['deactivated', `Deactivated ${counts.deactivated}`], ['all', 'All']]}
        />
      </PageHead>

      {error && <p className="alert" role="alert">{error}</p>}

      {open !== null && (
        <div className={`card pad open-banner ${open ? 'is-open' : ''}`}>
          <div>
            <h2>{open ? 'Open sign-up is ON' : 'Open sign-up is off'}</h2>
            <p className="muted">
              {open
                ? 'Anyone who creates an account gets full access right away. Turn it off to approve people yourself.'
                : 'New accounts wait here until you approve them as a recruiter or an admin.'}
            </p>
          </div>
          <button className={`btn ${open ? 'primary' : ''}`} disabled={busy === 'open'} aria-busy={busy === 'open'} onClick={toggleOpen}>
            {open ? 'Turn off, approve manually' : 'Turn on open sign-up'}
          </button>
        </div>
      )}

      <div className="card table-wrap">
        <table className="table stackable">
          <thead>
            <tr><th>Person</th><th>Signed up</th><th>Access</th><th aria-label="Actions" /></tr>
          </thead>
          <tbody>
            {!rows && !error && <SkeletonRows cols={4} rows={3} />}
            {rows && shown.length === 0 && (
              <tr><td colSpan={4} className="empty">{filter === 'pending' ? 'Nobody is waiting for approval' : 'No accounts here'}</td></tr>
            )}
            {shown.map((r) => {
              const st = accountStatus(r)
              return (
                <tr key={r.user_id}>
                  <td data-label="Person">
                    <strong>{displayName(r)}</strong>
                    <div className="sub">{r.email}</div>
                    {r.recruiter_id && <a className="small" href={`#recruiters/${r.recruiter_id}`}>View profile and performance</a>}
                  </td>
                  <td data-label="Signed up" className="nowrap mono">{new Date(r.signed_up).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td data-label="Access">
                    <div className="chips">
                      {/* one role, never two: an admin already has everything a recruiter has */}
                      {r.is_admin ? <span className="pill info">Admin</span> : r.recruiter_active && <span className="pill off">Recruiter</span>}
                      {r.user_id === me && <span className="pill off">You</span>}
                      {st === 'deactivated' && <span className="pill off">Deactivated</span>}
                      {st === 'pending' && <span className="pill warn">{open ? 'In via open sign-up' : 'Waiting'}</span>}
                      {st === 'unconfirmed' && <span className="pill off">Email not confirmed</span>}
                    </div>
                  </td>
                  <td className="row-actions">
                    {st === 'pending' && (
                      <button className="btn small accent-text" disabled={!!busy} aria-busy={busy === `r${r.user_id}`} onClick={() => act(`r${r.user_id}`, () => approveAsRecruiter(r))}><UserCheck size={14} /> Approve as recruiter</button>
                    )}
                    <MenuButton
                      label="Manage"
                      ariaLabel={`Manage ${displayName(r)}`}
                      icon={Settings2}
                      small
                      disabled={!!busy}
                      busy={busy.endsWith(r.user_id)}
                      items={manageItems(r, st, r.user_id === me)}
                      onPick={(id) => manage(id, r)}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
