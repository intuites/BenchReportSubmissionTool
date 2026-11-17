import { useState } from 'react'
import { CalendarPlus } from 'lucide-react'
import CrudPage from '../components/CrudPage'
import Modal from '../components/Modal'
import RecordForm from '../components/RecordForm'
import { supabase } from '../lib/supabase'
import { fmtDate, today } from '../lib/period'

export const INTERVIEW_FIELDS = [
  { name: 'interview_date', label: 'Interview date', type: 'date', required: true },
  { name: 'round', label: 'Round', placeholder: 'e.g. Client round 1' },
  { name: 'status', label: 'Status', type: 'select', required: true, options: ['Scheduled', 'Completed', 'Selected', 'Rejected', 'No show'] },
  { name: 'notes', label: 'Notes', type: 'textarea' },
]

export default function Submissions() {
  const [interviewFor, setInterviewFor] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  async function logInterview(payload) {
    const { error } = await supabase.from('bt_interviews').insert({ ...payload, submission_id: interviewFor.id })
    if (error) throw error
    setInterviewFor(null)
    setReloadKey((k) => k + 1)
  }

  return (
    <>
      <CrudPage
        title="Submissions"
        subtitle="Every candidate sent to a vendor, and the interviews each submission earned"
        table="bt_submissions"
        select="*, recruiters:bt_recruiters(name), candidates:bt_candidates(name), companies:bt_companies(name), vendor_contacts:bt_vendor_contacts(name, email), interviews:bt_interviews(count)"
        order="submission_date"
        noun="submission"
        addLabel="Log submission"
        reloadKey={reloadKey}
        columns={[
          { label: 'Submitted', render: (s) => <><span className="nowrap">{fmtDate(s.submission_date)}</span><div className="sub nowrap">by {s.recruiters?.name}</div></> },
          { label: 'Candidate', render: (s) => <><strong>{s.candidates?.name}</strong>{s.job_title && <div className="sub">{s.job_title}</div>}</> },
          { label: 'Vendor', render: (s) => <><strong>{s.companies?.name}</strong><div className="sub">{s.vendor_contacts?.name} · <a href={`mailto:${s.vendor_contacts?.email}`}>{s.vendor_contacts?.email}</a></div></> },
          { label: 'Rate', num: true, render: (s) => <span className="nowrap mono">{s.rate}</span> },
          { label: 'Interviews', render: (s) => { const n = s.interviews?.[0]?.count ?? 0; return n ? <span className="pill ok">{n} interview{n > 1 ? 's' : ''}</span> : <span className="muted">None</span> } },
        ]}
        rowActions={(row) => (
          <button className="btn small" onClick={() => setInterviewFor(row)}><CalendarPlus size={14} /> Interview</button>
        )}
        fields={[
          { name: 'submission_date', label: 'Submission date', type: 'date', required: true, default: today(), section: 'Submission' },
          { name: 'recruiter_id', label: 'Recruiter (you)', type: 'select', required: true, ref: { table: 'bt_recruiters' } },
          { name: 'candidate_id', label: 'Candidate', type: 'select', required: true, ref: { table: 'bt_candidates', select: 'id, name, recruiter_id' }, filterBy: 'recruiter_id' },
          { name: 'rate', label: 'Submitted rate', required: true, placeholder: 'e.g. $65/hr C2C' },
          { name: 'company_id', label: 'Company / vendor', type: 'select', required: true, ref: { table: 'bt_companies' }, section: 'Vendor' },
          { name: 'vendor_contact_id', label: 'Vendor recruiter', type: 'select', required: true, filterBy: 'company_id', filterRequired: true, filterLabel: 'a company', ref: { table: 'bt_vendor_contacts', select: 'id, name, email, company_id', label: (v) => `${v.name} · ${v.email}` } },
          { name: 'job_title', label: 'Job title / requirement', wide: true, section: 'Details' },
          { name: 'notes', label: 'Notes', type: 'textarea' },
        ]}
      />
      {interviewFor && (
        <Modal title="Log interview" onClose={() => setInterviewFor(null)}>
          <p className="context">
            <strong>{interviewFor.candidates?.name}</strong> submitted by <strong>{interviewFor.recruiters?.name}</strong> to{' '}
            <strong>{interviewFor.companies?.name}</strong> ({interviewFor.vendor_contacts?.email}) on {fmtDate(interviewFor.submission_date)}
          </p>
          <RecordForm fields={INTERVIEW_FIELDS} initial={{ interview_date: today(), status: 'Scheduled' }} onSubmit={logInterview} onCancel={() => setInterviewFor(null)} submitLabel="Log interview" />
        </Modal>
      )}
    </>
  )
}
