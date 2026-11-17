import CrudPage from '../components/CrudPage'
import { Status } from '../components/Status'
import { fmtDate } from '../lib/period'

export default function Candidates() {
  return (
    <CrudPage
      title="Candidates"
      subtitle="Bench consultants and the recruiter marketing each one"
      table="bt_candidates"
      select="*, recruiters:bt_recruiters(name)"
      order="name"
      ascending
      noun="candidate"
      addLabel="Add candidate"
      columns={[
        { label: 'Candidate', render: (c) => <><strong>{c.name}</strong><div className="sub">{c.email || ''}</div></> },
        { label: 'Skill', key: 'skill' },
        { label: 'Visa', key: 'visa_status' },
        { label: 'Recruiter', render: (c) => c.recruiters?.name || <span className="pill warn">Unassigned</span> },
        { label: 'Assigned', render: (c) => fmtDate(c.assigned_at?.slice(0, 10)) },
        { label: 'Status', render: (c) => <Status on={c.active} yes="On bench" no="Placed / off" /> },
      ]}
      fields={[
        { name: 'name', label: 'Full name', required: true },
        { name: 'recruiter_id', label: 'Assigned recruiter', type: 'select', ref: { table: 'bt_recruiters' } },
        { name: 'skill', label: 'Primary skill', placeholder: 'e.g. Java Full Stack' },
        { name: 'visa_status', label: 'Visa status', type: 'select', options: ['H1B', 'GC', 'GC-EAD', 'H4-EAD', 'USC', 'OPT', 'CPT', 'TN', 'Other'] },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'phone', label: 'Phone' },
        { name: 'active', label: 'Status', type: 'checkbox', checkLabel: 'On bench (needs submissions)' },
      ]}
    />
  )
}
