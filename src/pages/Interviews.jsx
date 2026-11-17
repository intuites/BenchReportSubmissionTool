import CrudPage from '../components/CrudPage'
import { InterviewStatus } from '../components/Status'
import { fmtDate } from '../lib/period'
import { INTERVIEW_FIELDS } from './Submissions'

const subLabel = (s) => `${fmtDate(s.submission_date)} · ${s.recruiters?.name} → ${s.candidates?.name} @ ${s.companies?.name}`

export default function Interviews() {
  return (
    <CrudPage
      title="Interviews"
      subtitle="Each interview is tied to the submission that produced it"
      table="bt_interviews"
      select="*, submissions:bt_submissions(submission_date, rate, recruiters:bt_recruiters(name), candidates:bt_candidates(name), companies:bt_companies(name), vendor_contacts:bt_vendor_contacts(email))"
      order="interview_date"
      noun="interview"
      addLabel="Log interview"
      columns={[
        { label: 'Date', render: (i) => <span className="nowrap mono">{fmtDate(i.interview_date)}</span> },
        { label: 'Candidate', render: (i) => <><strong>{i.submissions?.candidates?.name}</strong><div className="sub">by {i.submissions?.recruiters?.name}</div></> },
        { label: 'Vendor', render: (i) => <>{i.submissions?.companies?.name}<div className="sub">{i.submissions?.vendor_contacts?.email}</div></> },
        { label: 'Round', key: 'round' },
        { label: 'Status', render: (i) => <InterviewStatus value={i.status} /> },
      ]}
      fields={[
        { name: 'submission_id', label: 'Submission', type: 'select', required: true, wide: true, ref: { table: 'bt_submissions', select: 'id, submission_date, recruiters:bt_recruiters(name), candidates:bt_candidates(name), companies:bt_companies(name)', order: 'submission_date', desc: true, limit: 300, label: subLabel } },
        ...INTERVIEW_FIELDS,
      ]}
    />
  )
}
