import { useState } from 'react'
import CrudPage from '../components/CrudPage'
import PendingApprovals from '../components/PendingApprovals'
import { Status } from '../components/Status'
import RecruiterProfile from './RecruiterProfile'

export default function Recruiters({ admin, param }) {
  const [reloadKey, setReloadKey] = useState(0)
  if (param) return <RecruiterProfile id={param} admin={admin} />
  return (
    <CrudPage
      title="Recruiters"
      subtitle={admin ? 'Your bench sales team, and where follow-up emails are sent' : 'Your bench sales team. Only admins add or change recruiters'}
      before={admin && <PendingApprovals onChange={() => setReloadKey((k) => k + 1)} />}
      readOnly={!admin}
      reloadKey={reloadKey}
      table="bt_recruiters"
      select="*, candidates:bt_candidates(count)"
      order="name"
      ascending
      noun="recruiter"
      addLabel="Add recruiter"
      columns={[
        { label: 'Name', render: (r) => <a className="row-link" href={`#recruiters/${r.id}`}><strong>{r.name}</strong><span className="sub">View profile</span></a> },
        { label: 'Email', key: 'email' },
        { label: 'Phone', key: 'phone' },
        { label: 'Candidates', num: true, render: (r) => r.candidates?.[0]?.count ?? 0 },
        { label: 'Status', render: (r) => <Status on={r.active} /> },
      ]}
      fields={[
        { name: 'name', label: 'Full name', required: true },
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'phone', label: 'Phone' },
        { name: 'active', label: 'Status', type: 'checkbox', checkLabel: 'Active' },
      ]}
    />
  )
}
