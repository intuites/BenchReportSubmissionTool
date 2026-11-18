import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, ChevronLeft, ChevronRight, Plus, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { fmtDate, iso, periodRange, shift, today } from '../lib/period'
import PageHead from '../components/PageHead'
import Segmented from '../components/Segmented'
import DateField from '../components/DateField'
import Select from '../components/Select'
import { Count } from '../stageshow/kit/motion/Count'
import { SkeletonLine, SkeletonRows } from '../components/Loading'
import '../styles/dashboard-glass.css'

const PERIODS = [['day', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly']]
const LAST = { day: 'the day before', week: 'last week', month: 'last month' }
const sum = (rows, key) => (rows ?? []).reduce((n, r) => n + r[key], 0)
const addDays = (date, n) => { const d = new Date(`${date}T00:00:00`); d.setDate(d.getDate() + n); return iso(d) }
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000)
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)
// Status order and colours for the outcomes bar; each always shows with its label
const OUTCOMES = [['Selected', 'ok'], ['Scheduled', 'info'], ['Completed', 'neutral'], ['Rejected', 'bad'], ['No show', 'warn']]

// Open the Submissions form on arrival, optionally with values filled in
function logSubmission(prefill) {
  sessionStorage.setItem('bt-open-new', 'bt_submissions')
  if (prefill) sessionStorage.setItem('bt-prefill', JSON.stringify(prefill))
  location.hash = 'submissions'
}

export default function Dashboard({ admin }) {
  const [period, setPeriod] = useState('week')
  const [anchor, setAnchor] = useState(today())
  const [data, setData] = useState(null)
  const [upcoming, setUpcoming] = useState(null)
  const [error, setError] = useState('')
  // Admins see everyone's figures, or one recruiter's when picked. A recruiter's own
  // figures need no picker: the database only ever gives them their own records.
  const [who, setWho] = useState('')
  const [team, setTeam] = useState([])
  useEffect(() => {
    if (admin) supabase.from('bt_recruiters').select('id, name').order('name').then(({ data: rows }) => setTeam(rows ?? []))
  }, [admin])
  const mine = (rows) => (who ? (rows ?? []).filter((r) => r.recruiter_id === who) : rows)
  const { from, to } = periodRange(period, anchor)
  const prev = periodRange(period, shift(period, anchor, -1))
  // A single day is one bar, so the daily view charts the two weeks leading up to it
  const chart = period === 'day' ? { from: addDays(anchor, -13), to: anchor } : { from, to }

  // Old figures stay on screen while the next period loads, so they roll to the new ones.
  // Counting happens in SQL so the API's 1,000-row cap can't truncate it.
  useEffect(() => {
    let live = true
    Promise.all([
      supabase.rpc('bt_recruiter_activity', { p_from: from, p_to: to }),
      supabase.rpc('bt_missed_submissions', { p_from: from, p_to: to }),
      supabase.rpc('bt_recruiter_activity', { p_from: prev.from, p_to: prev.to }),
      supabase.rpc('bt_dashboard', { p_from: from, p_to: to, p_recruiter: who || null }),
      chart.from === from ? null : supabase.rpc('bt_dashboard', { p_from: chart.from, p_to: chart.to, p_recruiter: who || null }),
    ]).then((results) => {
      if (!live) return
      const failed = results.find((r) => r?.error)
      if (failed) return setError(failed.error.message.includes('bt_dashboard') ? 'The database is missing the dashboard report. Run supabase/schema.sql again in the Supabase SQL Editor.' : failed.error.message)
      setError('')
      const [activity, missed, before, dash, chartDash] = results.map((r) => r?.data)
      setData({ activity: mine(activity), missed: mine(missed), before: mine(before), statuses: dash.statuses ?? {}, days: (chartDash ?? dash).days ?? [] })
    })
    return () => { live = false }
    // prev and chart are derived from the same inputs as from/to
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, who])

  // Next scheduled interviews, whatever period is shown
  useEffect(() => {
    let q = supabase.from('bt_interviews')
      .select('id, interview_date, round, submissions:bt_submissions!inner(recruiter_id, recruiters:bt_recruiters(name), candidates:bt_candidates(name), companies:bt_companies(name))')
      .eq('status', 'Scheduled').gte('interview_date', today())
    if (who) q = q.eq('submissions.recruiter_id', who)
    q.order('interview_date').limit(6).then(({ data: rows, error: e }) => setUpcoming(e ? [] : rows))
  }, [who])

  const byRecruiter = useMemo(
    () => (data?.activity ?? []).map((r) => ({ ...r, missed: data.missed.filter((m) => m.recruiter_id === r.recruiter_id).length })),
    [data],
  )
  // Totals are the sum of the rows, so the table always adds up to them
  const subs = sum(byRecruiter, 'submissions')
  const ints = sum(byRecruiter, 'interviews')
  const selected = data?.statuses?.Selected ?? 0
  const maxInt = Math.max(1, ...byRecruiter.map((r) => r.interviews))
  const label = period === 'day' ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`

  return (
    <section className="page dash-glass">
      <PageHead title="Dashboard" subtitle={label}>
        {admin && (
          <div className="field who-pick">
            <Select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Whose figures">
              <option value="">All recruiters</option>
              {team.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
          </div>
        )}
        <Segmented label="Report period" items={PERIODS} value={period} onChange={setPeriod} />
        <div className="stepper">
          <button className="icon-btn" onClick={() => setAnchor(shift(period, anchor, -1))} aria-label="Previous period"><ChevronLeft size={18} /></button>
          <DateField value={anchor} onChange={(e) => e.target.value && setAnchor(e.target.value)} aria-label="Pick a date" required />
          <button className="icon-btn" onClick={() => setAnchor(shift(period, anchor, 1))} aria-label="Next period"><ChevronRight size={18} /></button>
        </div>
        {anchor !== today() && <button className="btn ghost" onClick={() => setAnchor(today())}>Today</button>}
        <button className="btn primary" onClick={() => logSubmission()}><Plus size={16} /> Log submission</button>
      </PageHead>

      {error && <p className="alert" role="alert">{error}</p>}

      <div className="card figures">
        <Figure label="Submissions" value={data && subs} note={data && <Change now={subs} was={sum(data.before, 'submissions')} than={LAST[period]} />} />
        <Figure label="Interviews" accent value={data && ints} note={data && <><Change now={ints} was={sum(data.before, 'interviews')} than={LAST[period]} /> <span><b>{pct(ints, subs)}%</b> hit rate</span></>} />
        <Figure label="Selected" good={selected > 0} value={data && selected} note={data && (ints ? <span><b>{pct(selected, ints)}%</b> of interviews</span> : 'No interviews yet')} />
        <Figure label="Idle candidates" warn={data?.missed.length > 0} value={data?.missed.length} note={data && (data.missed.length ? 'No submissions this period' : 'Everyone was submitted')} />
      </div>

      <div className="dash-row wide-left">
        <div className="card">
          <header className="card-head">
            <h2>Daily activity</h2>
            <span className="muted small">{period === 'day' ? 'The 14 days to this one' : label}</span>
          </header>
          <ActivityChart days={data?.days} focus={period === 'day' ? anchor : null} />
        </div>
        <div className="card">
          <header className="card-head"><h2>Interview outcomes</h2><span className="muted small">{data ? `${Object.values(data.statuses).reduce((a, b) => a + b, 0)} this period` : ''}</span></header>
          <Outcomes statuses={data?.statuses} />
        </div>
      </div>

      <div className="card">
        <header className="card-head">
          <h2>Recruiters</h2>
          <span className="muted small">Submissions, the interviews they earned, and who was interviewed</span>
        </header>
        <table className="table stackable">
          <thead><tr><th>Recruiter</th><th className="num">Submissions</th><th>Interviews</th><th className="num">Hit rate</th><th>Interviewed</th></tr></thead>
          <tbody>
            {!data && <SkeletonRows cols={5} rows={4} />}
            {data && byRecruiter.length === 0 && <tr><td colSpan={5} className="empty">Add recruiters to see activity</td></tr>}
            {byRecruiter.map((r) => (
              <tr key={r.recruiter_id}>
                <td data-label="Recruiter"><div className="who"><span className="initials" aria-hidden>{r.recruiter_name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span><div><a className="row-link" href={`#recruiters/${r.recruiter_id}`}><strong className="nowrap">{r.recruiter_name}</strong></a>{r.missed > 0 && <div className="sub warn-text nowrap">{r.missed} idle candidate{r.missed > 1 ? 's' : ''}</div>}</div></div></td>
                <td data-label="Submissions" className="num">{r.submissions}</td>
                <td data-label="Interviews"><div className="meter"><i><span style={{ width: `${(r.interviews / maxInt) * 100}%` }} /></i><b>{r.interviews}</b></div></td>
                <td data-label="Hit rate" className="num">{r.submissions ? `${pct(r.interviews, r.submissions)}%` : '—'}</td>
                <td data-label="Interviewed">
                  {r.interviewed.length ? (
                    <div className="chips">{r.interviewed.map(({ label: l, count }) => <span key={l} className="chip">{l}{count > 1 && <em>×{count}</em>}</span>)}</div>
                  ) : <span className="muted">None yet</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="dash-row wide-right">
        <div className="card">
          <header className="card-head"><h2>Coming up</h2><a href="#interviews" className="small">All interviews</a></header>
          <Upcoming rows={upcoming} />
        </div>
        <div className="card">
          <header className="card-head">
            <h2>Idle candidates</h2>
            <span className="muted small">Assigned, with no submission this period</span>
          </header>
          <table className="table stackable">
            <thead><tr><th>Candidate</th><th>Recruiter</th><th className="num">Idle</th><th aria-label="Actions" /></tr></thead>
            <tbody>
              {!data && <SkeletonRows cols={4} rows={3} />}
              {data && data.missed.length === 0 && <tr><td colSpan={4} className="empty good">Every assigned candidate was submitted</td></tr>}
              {data?.missed.map((m) => {
                const days = m.last_submission ? daysBetween(m.last_submission, today()) : null
                return (
                  <tr key={m.candidate_id}>
                    <td data-label="Candidate"><strong className="nowrap">{m.candidate_name}</strong>{m.skill && <div className="sub">{m.skill}</div>}</td>
                    <td data-label="Recruiter" className="nowrap">{m.recruiter_name}</td>
                    <td data-label="Idle" className="num">
                      {days == null ? <span className="pill strong">Never submitted</span> : (
                        <><span className={`idle-days ${days >= 14 ? 'long' : ''}`}>{days} day{days === 1 ? '' : 's'}</span><div className="sub nowrap">since {fmtDate(m.last_submission)}</div></>
                      )}
                    </td>
                    <td className="row-actions">
                      <button className="btn small" onClick={() => logSubmission({ recruiter_id: m.recruiter_id, candidate_id: m.candidate_id })} aria-label={`Log a submission for ${m.candidate_name}`}><Send size={14} /> Log</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

// Stageshow's Count: changed digits roll from the old figure to the new one
function Figure({ label, value, note, accent, warn, good, format }) {
  return (
    <div className={`figure ${accent ? 'accent' : ''} ${warn ? 'warn' : ''} ${good ? 'good' : ''}`}>
      <span>{label}</span>
      <strong>{value == null ? <span className="skeleton" /> : <Count value={value} format={format} duration={900} />}</strong>
      <small>{note || ' '}</small>
    </div>
  )
}

function Change({ now, was, than }) {
  const d = now - was
  if (d === 0) return <span><b>±0</b> vs {than}</span>
  return <span><b className={d > 0 ? 'up' : 'down'}>{d > 0 ? `+${d}` : `−${-d}`}</b> vs {than}</span>
}

// Two series on one count axis: submissions and interviews per day, side by side.
// Hovering or focusing a day shows its numbers; the table view is the Recruiters card and the pages behind it.
// xLabel and readLabel let other pages chart months instead of days
export function ActivityChart({ days, focus, xLabel = dayLabel, readLabel = fmtDate, prompt = 'Point at a day for its numbers' }) {
  const [hover, setHover] = useState(null)
  if (!days) return <div className="chart--loading sk" aria-hidden />
  const max = Math.max(4, ...days.map((d) => Math.max(d.submissions, d.interviews)))
  const top = Math.ceil(max / 4) * 4
  const ticks = [top, top / 2, 0]
  const every = days.length > 16 ? 5 : 1
  const t = { s: sum(days, 'submissions'), i: sum(days, 'interviews') }
  const shown = hover ?? days.findIndex((d) => d.day === (focus ?? ''))
  const h = shown >= 0 ? days[shown] : null
  return (
    <div className="chart-wrap">
      <div className="chart-legend">
        <span><i className="sw sw--sub" /> Submissions <b>{t.s}</b></span>
        <span><i className="sw sw--int" /> Interviews <b>{t.i}</b></span>
        <span className="chart-readout" aria-live="polite">{h ? <>{readLabel(h.day)}: <b>{h.submissions}</b> submitted, <b>{h.interviews}</b> interviewed</> : prompt}</span>
      </div>
      <div className="chart" role="img" aria-label={`Daily submissions and interviews. ${t.s} submissions and ${t.i} interviews in total.`}>
        <div className="chart-axis" aria-hidden>{ticks.map((v) => <span key={v}>{v}</span>)}</div>
        <div className="chart-plot" onMouseLeave={() => setHover(null)}>
          <span className="chart-grids" aria-hidden>{ticks.map((v) => <i key={v} className={`chart-grid ${v ? '' : 'base'}`} style={{ bottom: `${(v / top) * 100}%` }} />)}</span>
          {days.map((d, i) => (
            <button
              key={d.day}
              type="button"
              className={`chart-day ${i === shown ? 'on' : ''} ${d.day === today() ? 'today' : ''}`}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${fmtDate(d.day)}: ${d.submissions} submissions, ${d.interviews} interviews`}
            >
              <span className="bars">
                <span className="bar bar--sub" style={{ height: `${(d.submissions / top) * 100}%`, animationDelay: `${i * 18}ms` }} />
                <span className="bar bar--int" style={{ height: `${(d.interviews / top) * 100}%`, animationDelay: `${i * 18 + 60}ms` }} />
              </span>
              <span className="chart-x">{i % every === 0 || i === days.length - 1 ? xLabel(d.day, days.length) : ''}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
const dayLabel = (day, n) => {
  const d = new Date(`${day}T00:00:00`)
  return n <= 7 ? d.toLocaleDateString('en-US', { weekday: 'short' }) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// One stacked bar of this period's interviews by status, with a labelled row per status
export function Outcomes({ statuses }) {
  if (!statuses) return <div className="outcomes" aria-busy="true"><SkeletonLine width="100%" height={12} />{[64, 52, 70, 48, 58].map((w) => <SkeletonLine key={w} width={`${w}%`} />)}</div>
  const total = Object.values(statuses).reduce((a, b) => a + b, 0)
  if (!total) return <p className="empty-note">No interviews in this period yet</p>
  return (
    <div className="outcomes">
      <div className="outcome-bar" role="img" aria-label={OUTCOMES.map(([s]) => `${s} ${statuses[s] ?? 0}`).join(', ')}>
        {OUTCOMES.filter(([s]) => statuses[s]).map(([s, tone]) => <span key={s} className={`seg seg--${tone}`} style={{ flexGrow: statuses[s] }} />)}
      </div>
      <ul className="outcome-list">
        {OUTCOMES.map(([s, tone]) => (
          <li key={s} className={statuses[s] ? '' : 'zero'}>
            <i className={`dot seg--${tone}`} aria-hidden />
            <span>{s}</span>
            <b>{statuses[s] ?? 0}</b>
            <small>{pct(statuses[s] ?? 0, total)}%</small>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Upcoming({ rows }) {
  if (!rows) return <ul className="upcoming" aria-busy="true">{[0, 1, 2].map((i) => <li key={i}><span className="sk date-sk" /><div className="up-main"><SkeletonLine width="62%" /><SkeletonLine width="40%" height={12} /></div></li>)}</ul>
  if (!rows.length) return <p className="empty-note"><CalendarClock size={18} strokeWidth={1.5} /> No interviews scheduled ahead</p>
  return (
    <ul className="upcoming">
      {rows.map((r) => {
        const d = new Date(`${r.interview_date}T00:00:00`)
        const n = daysBetween(today(), r.interview_date)
        const s = r.submissions ?? {}
        return (
          <li key={r.id}>
            <span className="date-tile" aria-hidden><small>{d.toLocaleDateString('en-US', { month: 'short' })}</small><b>{d.getDate()}</b></span>
            <div className="up-main">
              <strong>{s.candidates?.name} <span className="muted">at {s.companies?.name}</span></strong>
              <div className="sub">{[r.round, s.recruiters?.name].filter(Boolean).join(' · ')}</div>
            </div>
            <span className={`when ${n >= 0 && n <= 1 ? 'soon' : ''}`}>{n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n === -1 ? 'Yesterday' : n < 0 ? `${-n} days ago` : `In ${n} days`}</span>
          </li>
        )
      })}
    </ul>
  )
}
