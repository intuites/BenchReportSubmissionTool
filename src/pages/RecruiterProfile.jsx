import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Mail, Pencil, Phone } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { WORK, useLive } from '../lib/live'
import { fmtDate, iso, today } from '../lib/period'
import PageHead from '../components/PageHead'
import Segmented from '../components/Segmented'
import Modal from '../components/Modal'
import RecordForm from '../components/RecordForm'
import { Status } from '../components/Status'
import { SkeletonLine, SkeletonRows } from '../components/Loading'
import { Count } from '../stageshow/kit/motion/Count'
import { ActivityChart, Outcomes } from './Dashboard'

const RANGES = [['month', 'This month'], ['quarter', 'Last 3 months'], ['year', 'This year']]
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)
const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]) }
const FIELDS = [
  { name: 'name', label: 'Full name', required: true },
  { name: 'email', label: 'Email', type: 'email', required: true },
  { name: 'phone', label: 'Phone' },
  { name: 'active', label: 'Status', type: 'checkbox', checkLabel: 'Active' },
]

function rangeFor(id) {
  const now = new Date(`${today()}T00:00:00`)
  if (id === 'month') return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: today() }
  if (id === 'quarter') return { from: iso(new Date(now.getFullYear(), now.getMonth() - 2, 1)), to: today() }
  return { from: iso(new Date(now.getFullYear(), 0, 1)), to: today() }
}
const monthShort = (day) => new Date(`${day}T00:00:00`).toLocaleDateString('en-US', { month: 'short' })
const monthLong = (day) => new Date(`${day}T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

// One recruiter: who they are, how they are doing, and what they are working on.
// Admins can edit the profile; everyone on the team can read it.
export default function RecruiterProfile({ id, admin }) {
  const [range, setRange] = useState('month')
  const [person, setPerson] = useState(null)
  const [perf, setPerf] = useState(null)
  const [rank, setRank] = useState(null)
  const [cands, setCands] = useState(null)
  const [subs, setSubs] = useState(null)
  const [due, setDue] = useState([])
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const { from, to } = rangeFor(range)

  async function loadPerson() {
    const [p, c, s, d] = await Promise.all([
      supabase.from('bt_recruiters').select('*').eq('id', id).limit(1),
      supabase.from('bt_candidates').select('id, name, skill, visa_status, active').eq('recruiter_id', id).order('name'),
      supabase.from('bt_submissions').select('id, submission_date, rate, job_title, candidates:bt_candidates(name), companies:bt_companies(name), interviews:bt_interviews(count)').eq('recruiter_id', id).order('submission_date', { ascending: false }).limit(8),
      supabase.from('bt_followups_due').select('candidate_id, days_idle').eq('recruiter_id', id),
    ])
    const failed = [p, c, s, d].find((r) => r.error)
    if (failed) return setError(failed.error.message)
    if (!p.data?.length) return setError('This recruiter no longer exists.')
    setPerson(p.data[0]); setCands(c.data); setSubs(s.data); setDue(d.data)
  }
  useEffect(() => { loadPerson() }, [id])
  const [tick, setTick] = useState(0)
  useLive(WORK, () => { loadPerson(); setTick((t) => t + 1) })

  const shown = useRef('')
  useEffect(() => {
    let live = true
    // a new person or period clears the figures; a live update swaps them in place
    const key = `${id}|${from}|${to}`
    if (shown.current !== key) setPerf(null)
    shown.current = key
    Promise.all([
      supabase.rpc('bt_recruiter_profile', { p_recruiter: id, p_from: from, p_to: to }),
      supabase.rpc('bt_recruiter_activity', { p_from: from, p_to: to }),
    ]).then(([p, a]) => {
      if (!live) return
      if (p.error) return setError(p.error.message.includes('recruiter_profile') ? 'The database is missing the profile report. Run supabase/schema.sql again in the Supabase SQL Editor.' : p.error.message)
      setPerf(p.data)
      // rank by interviews, then submissions, among everyone with activity or still active
      const order = (a.data ?? []).slice().sort((x, y) => y.interviews - x.interviews || y.submissions - x.submissions)
      const at = order.findIndex((r) => r.recruiter_id === id)
      setRank(at >= 0 ? { place: at + 1, of: order.length } : null)
    })
    return () => { live = false }
  }, [id, from, to, tick])

  async function save(payload) {
    const { error: e } = await supabase.from('bt_recruiters').update(payload).eq('id', id)
    if (e) throw e
    setEditing(false)
    loadPerson()
  }

  const idle = useMemo(() => Object.fromEntries(due.map((d) => [d.candidate_id, d.days_idle])), [due])
  const months = perf?.months?.map((m) => ({ day: m.month, submissions: m.submissions, interviews: m.interviews }))
  const initials = person?.name.split(' ').map((w) => w[0]).slice(0, 2).join('')

  return (
    <section className="page">
      <a className="back-link" href="#recruiters"><ArrowLeft size={16} strokeWidth={1.5} /> All recruiters</a>
      <PageHead
        title={person ? <span className="profile-title"><span className="initials big" aria-hidden>{initials}</span>{person.name}</span> : <SkeletonLine width={260} height={34} />}
        subtitle={person && (
          <span className="profile-meta">
            <a href={`mailto:${person.email}`}><Mail size={14} strokeWidth={1.5} /> {person.email}</a>
            {person.phone && <span><Phone size={14} strokeWidth={1.5} /> {person.phone}</span>}
            <Status on={person.active} />
          </span>
        )}
      >
        <Segmented label="Performance period" items={RANGES} value={range} onChange={setRange} />
        {admin && person && <button className="btn" onClick={() => setEditing(true)}><Pencil size={15} /> Edit profile</button>}
      </PageHead>

      {error && <p className="alert" role="alert">{error}</p>}

      <div className="card figures">
        <Figure label="Submissions" value={perf?.submissions} note={RANGES.find(([r]) => r === range)[1]} />
        <Figure label="Interviews" accent value={perf?.interviews} note={perf && (rank ? <span><b>{ordinal(rank.place)}</b> of {rank.of} on the team</span> : 'No activity yet')} />
        <Figure label="Hit rate" value={perf && pct(perf.interviews, perf.submissions)} format={(n) => `${Math.round(n)}%`} note={perf && <span><b>{perf.interviews}</b> of {perf.submissions} submissions</span>} />
        <Figure label="Selected" good={perf?.selected > 0} value={perf?.selected} note={perf && (perf.interviews ? <span><b>{pct(perf.selected, perf.interviews)}%</b> of interviews</span> : 'No interviews yet')} />
      </div>

      <div className="dash-row wide-left">
        <div className="card">
          <header className="card-head"><h2>Last six months</h2><span className="muted small">Submissions and interviews per month</span></header>
          <ActivityChart days={months} xLabel={monthShort} readLabel={monthLong} prompt="Point at a month for its numbers" />
        </div>
        <div className="card">
          <header className="card-head"><h2>Interview outcomes</h2><span className="muted small">{perf ? RANGES.find(([r]) => r === range)[1] : ''}</span></header>
          <Outcomes statuses={perf?.statuses} />
        </div>
      </div>

      <div className="dash-row wide-right">
        <div className="card">
          <header className="card-head">
            <h2>Candidates {cands && <span className="count neutral">{cands.filter((c) => c.active).length}</span>}</h2>
            <span className="muted small">{due.length ? `${due.length} overdue for a submission` : 'Assigned to this recruiter'}</span>
          </header>
          {!cands ? <table className="table"><tbody><SkeletonRows cols={2} rows={3} /></tbody></table>
            : cands.length === 0 ? <p className="empty-line">No candidates assigned yet</p>
            : (
              <ul className="due-list">
                {cands.map((c) => (
                  <li key={c.id} className={c.active ? '' : 'inactive'}>
                    <div className="due-main">
                      <strong>{c.name}</strong>
                      <span className="sub">{[c.skill, c.visa_status, c.active ? null : 'Off the bench'].filter(Boolean).join(' · ') || '—'}</span>
                    </div>
                    {idle[c.id] != null && <span className={`idle-days ${idle[c.id] >= 14 ? 'long' : ''}`}>{idle[c.id]} days idle</span>}
                  </li>
                ))}
              </ul>
            )}
        </div>

        <div className="card">
          <header className="card-head"><h2>Recent submissions</h2><a href="#submissions" className="small">All submissions</a></header>
          <table className="table stackable">
            <thead><tr><th>Submitted</th><th>Candidate</th><th>Vendor</th><th>Rate</th><th>Interviews</th></tr></thead>
            <tbody>
              {!subs && <SkeletonRows cols={5} rows={3} />}
              {subs?.length === 0 && <tr><td colSpan={5} className="empty">No submissions yet</td></tr>}
              {subs?.map((s) => {
                const n = s.interviews?.[0]?.count ?? 0
                return (
                  <tr key={s.id}>
                    <td data-label="Submitted" className="nowrap">{fmtDate(s.submission_date)}</td>
                    <td data-label="Candidate"><strong>{s.candidates?.name}</strong>{s.job_title && <div className="sub">{s.job_title}</div>}</td>
                    <td data-label="Vendor">{s.companies?.name}</td>
                    <td data-label="Rate" className="nowrap">{s.rate}</td>
                    <td data-label="Interviews">{n ? <span className="pill ok">{n}</span> : <span className="muted">None</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editing && person && (
        <Modal title={`Edit ${person.name}`} onClose={() => setEditing(false)}>
          <RecordForm fields={FIELDS} initial={person} onSubmit={save} onCancel={() => setEditing(false)} submitLabel="Save profile" />
        </Modal>
      )}
    </section>
  )
}

function Figure({ label, value, note, accent, good, format }) {
  return (
    <div className={`figure ${accent ? 'accent' : ''} ${good ? 'good' : ''}`}>
      <span>{label}</span>
      <strong>{value == null ? <span className="skeleton" /> : <Count value={value} format={format} duration={900} />}</strong>
      <small>{note || ' '}</small>
    </div>
  )
}
