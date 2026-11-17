import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUpRight, BadgeCheck, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Plus, Send, UserX } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { fmtDate, iso, periodRange, shift, today } from '../lib/period'
import PageHead from '../components/PageHead'
import Segmented from '../components/Segmented'
import DateField from '../components/DateField'
import { Count } from '../stageshow/kit/motion/Count'
import { SkeletonLine } from '../components/Loading'
import '../styles/dashboard.css'

const PERIODS = [['day', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly']]
const LAST = { day: 'the day before', week: 'last week', month: 'last month' }
const NAMES = { day: 'Today', week: 'This week', month: 'This month' }
const sum = (rows, key) => (rows ?? []).reduce((n, r) => n + r[key], 0)
const addDays = (date, n) => { const d = new Date(`${date}T00:00:00`); d.setDate(d.getDate() + n); return iso(d) }
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000)
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)
const plural = (n, one, many = `${one}s`) => (n === 1 ? one : many)
const initials = (name) => name.split(' ').map((w) => w[0]).slice(0, 2).join('')
// one of the three accent-derived tones, fixed per name, so a person keeps their colour everywhere
const toneOf = (name = '') => `var(--c${(Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0) % 3) + 1})`
// Status order and colours for the outcomes; each always shows with its label
const OUTCOMES = [['Selected', 'ok'], ['Scheduled', 'info'], ['Completed', 'neutral'], ['Rejected', 'bad'], ['No show', 'warn']]

// Open the Submissions form on arrival, optionally with values filled in
function logSubmission(prefill) {
  sessionStorage.setItem('bt-open-new', 'bt_submissions')
  if (prefill) sessionStorage.setItem('bt-prefill', JSON.stringify(prefill))
  location.hash = 'submissions'
}

export default function Dashboard() {
  const [period, setPeriod] = useState('week')
  const [anchor, setAnchor] = useState(today())
  const [data, setData] = useState(null)
  const [upcoming, setUpcoming] = useState(null)
  const [error, setError] = useState('')
  const idleRef = useRef(null)
  const { from, to } = periodRange(period, anchor)
  const prev = periodRange(period, shift(period, anchor, -1))
  // A single day is one point, so the daily view charts the two weeks leading up to it
  const chart = period === 'day' ? { from: addDays(anchor, -13), to: anchor } : { from, to }

  // Old figures stay on screen while the next period loads, so they roll to the new ones.
  // Counting happens in SQL so the API's 1,000-row cap can't truncate it.
  useEffect(() => {
    let live = true
    Promise.all([
      supabase.rpc('bt_recruiter_activity', { p_from: from, p_to: to }),
      supabase.rpc('bt_missed_submissions', { p_from: from, p_to: to }),
      supabase.rpc('bt_recruiter_activity', { p_from: prev.from, p_to: prev.to }),
      supabase.rpc('bt_dashboard', { p_from: from, p_to: to }),
      chart.from === from ? null : supabase.rpc('bt_dashboard', { p_from: chart.from, p_to: chart.to }),
    ]).then((results) => {
      if (!live) return
      const failed = results.find((r) => r?.error)
      if (failed) return setError(failed.error.message.includes('bt_dashboard') ? 'The database is missing the dashboard report. Run supabase/schema.sql again in the Supabase SQL Editor.' : failed.error.message)
      setError('')
      const [activity, missed, before, dash, chartDash] = results.map((r) => r?.data)
      setData({ activity, missed, before, statuses: dash.statuses ?? {}, days: (chartDash ?? dash).days ?? [] })
    })
    return () => { live = false }
    // prev and chart are derived from the same inputs as from/to
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to])

  // Next scheduled interviews, whatever period is shown
  useEffect(() => {
    supabase.from('bt_interviews')
      .select('id, interview_date, round, submissions:bt_submissions(recruiters:bt_recruiters(name), candidates:bt_candidates(name), companies:bt_companies(name))')
      .eq('status', 'Scheduled').gte('interview_date', today()).order('interview_date').limit(6)
      .then(({ data: rows, error: e }) => setUpcoming(e ? [] : rows))
  }, [])

  const byRecruiter = useMemo(
    () => (data?.activity ?? [])
      .map((r) => ({ ...r, missed: data.missed.filter((m) => m.recruiter_id === r.recruiter_id).length }))
      .sort((a, b) => b.interviews - a.interviews || b.submissions - a.submissions),
    [data],
  )
  // Totals are the sum of the rows, so the leaderboard always adds up to them
  const subs = sum(byRecruiter, 'submissions')
  const ints = sum(byRecruiter, 'interviews')
  const selected = data?.statuses?.Selected ?? 0
  const label = period === 'day' ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`
  const review = () => idleRef.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })

  return (
    <section className="page dx">
      <PageHead title="Dashboard" subtitle={label}>
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

      <Hero data={data} subs={subs} ints={ints} selected={selected} period={period} label={label} onReview={review} />

      <div className="dx-kpis">
        <Kpi tone={3} icon={Send} label="Submissions" href="#submissions" value={data && subs} note={data && <Change now={subs} was={sum(data.before, 'submissions')} than={LAST[period]} />}>
          <Spark days={data?.days} k="submissions" />
        </Kpi>
        <Kpi tone={2} icon={CalendarClock} label="Interviews" href="#interviews" value={data && ints} note={data && <Change now={ints} was={sum(data.before, 'interviews')} than={LAST[period]} />}>
          <Spark days={data?.days} k="interviews" />
        </Kpi>
        <Kpi tone={1} icon={BadgeCheck} label="Selected" href="#interviews" value={data && selected} note={data && (ints ? <span><b className="up">{pct(selected, ints)}%</b> of interviews</span> : 'No interviews yet')}>
          <Segments share={data && ints ? selected / ints : 0} />
        </Kpi>
        <Kpi tone={4} icon={UserX} label="Idle candidates" onClick={review} value={data?.missed.length} note={data && (data.missed.length ? 'Waiting for a submission' : 'Everyone was submitted')}>
          <Faces names={data?.missed.map((m) => m.candidate_name)} />
        </Kpi>
      </div>

      <div className="dx-grid">
        <div className="card dx-card dx-span-8">
          <header className="dx-head"><div><h2>Activity</h2><p>{period === 'day' ? 'The 14 days to this one' : label}</p></div></header>
          <TrendChart days={data?.days} focus={period === 'day' ? anchor : null} />
        </div>
        <div className="card dx-card dx-span-4">
          <header className="dx-head"><div><h2>Interview outcomes</h2><p>How this period's interviews stand</p></div></header>
          <Ring statuses={data?.statuses} />
        </div>

        <div className="card dx-card dx-span-7">
          <header className="dx-head">
            <div><h2>Recruiters</h2><p>Ranked by the interviews they earned</p></div>
            <a href="#recruiters" className="dx-more">All recruiters <ArrowUpRight size={14} /></a>
          </header>
          <Leaderboard rows={data && byRecruiter} />
        </div>
        <div className="card dx-card dx-span-5">
          <header className="dx-head">
            <div><h2>Coming up</h2><p>The next scheduled interviews</p></div>
            <a href="#interviews" className="dx-more">All interviews <ArrowUpRight size={14} /></a>
          </header>
          <Upcoming rows={upcoming} />
        </div>

        <div className="card dx-card dx-span-12 dx-idle-list" ref={idleRef}>
          <header className="dx-head">
            <div><h2>Idle candidates {data?.missed.length > 0 && <span className="dx-count">{data.missed.length}</span>}</h2><p>Assigned, with no submission this period</p></div>
          </header>
          <IdleList rows={data?.missed} />
        </div>
      </div>
    </section>
  )
}

// The lead: the period told as one sentence over soft light in the accent's colours, the selection rate as a gauge
function Hero({ data, subs, ints, selected, period, label, onReview }) {
  const idle = data?.missed.length
  return (
    <section className="dx-hero" aria-label="Summary">
      <div className="dx-aurora" aria-hidden><i /><i /><i /></div>
      <div className="dx-hero-copy">
        <span className="dx-eyebrow"><i aria-hidden /> {NAMES[period]} <span>· {label}</span></span>
        {data ? (
          <h2 className="dx-headline">
            <Count value={subs} duration={900} /> {plural(subs, 'submission')} turned into{' '}
            <em><Count value={ints} duration={900} /> {plural(ints, 'interview')}</em> and{' '}
            <em className="win"><Count value={selected} duration={900} /> {plural(selected, 'selection')}</em>
          </h2>
        ) : <h2 className="dx-headline" aria-busy="true"><span className="dx-sk" /><span className="dx-sk short" /></h2>}
        <div className="dx-chips">
          <span className="dx-chip"><i style={{ background: 'var(--c3)' }} /><b>{data ? `${pct(ints, subs)}%` : '–'}</b> reached interview</span>
          <span className="dx-chip"><i style={{ background: 'var(--c1)' }} /><b>{data ? `${pct(selected, ints)}%` : '–'}</b> of interviews selected</span>
          {idle > 0
            ? <button type="button" className="dx-chip on" onClick={onReview}><i style={{ background: 'var(--c4)' }} /><b>{idle}</b> idle, review <ArrowDown size={14} aria-hidden /></button>
            : data && <span className="dx-chip"><CheckCircle2 size={14} aria-hidden /> No idle candidates</span>}
        </div>
      </div>
      <Gauge value={data ? pct(selected, ints) : null} selected={selected} ints={ints} />
    </section>
  )
}

// Half a dial, filled to the share of interviews that ended in a selection
function Gauge({ value, selected, ints }) {
  const arc = 'M20,110 A90,90 0 0 1 200,110'
  return (
    <div className="dx-gauge" role="img" aria-label={value == null ? 'Selection rate loading' : `Selection rate ${value}%: ${selected} of ${ints} interviews`}>
      <svg viewBox="0 0 220 124" aria-hidden>
        <defs>
          <linearGradient id="dx-gauge" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--c3)" /><stop offset="0.5" stopColor="var(--c2)" /><stop offset="1" stopColor="var(--c1)" />
          </linearGradient>
        </defs>
        <path className="dx-gauge-track" d={arc} pathLength="100" />
        {[0, 25, 50, 75, 100].map((t) => {
          const a = Math.PI * (1 - t / 100)
          return <line key={t} className="dx-gauge-tick" x1={110 + Math.cos(a) * 70} y1={110 - Math.sin(a) * 70} x2={110 + Math.cos(a) * 64} y2={110 - Math.sin(a) * 64} />
        })}
        {value > 0 && <path className="dx-gauge-fill" d={arc} pathLength="100" stroke="url(#dx-gauge)" style={{ strokeDasharray: `${value} 100` }} />}
      </svg>
      <div className="dx-gauge-mid">
        <b>{value == null ? '–' : `${value}%`}</b>
        <span>Selection rate</span>
        <small>{value == null ? ' ' : ints ? `${selected} of ${ints} ${plural(ints, 'interview')}` : 'No interviews yet'}</small>
      </div>
    </div>
  )
}

// A figure on its own tinted card; a link to its page, or a button for idle candidates
function Kpi({ tone, icon: Icon, label, value, note, href, onClick, children }) {
  const Tag = href ? 'a' : 'button'
  return (
    <Tag className="dx-kpi" style={{ '--tone': `var(--c${tone})` }} {...(href ? { href } : { type: 'button', onClick })}>
      <span className="dx-kpi-top">
        <span className="dx-kpi-icon" aria-hidden><Icon size={18} strokeWidth={2} /></span>
        <span className="dx-kpi-label">{label}</span>
        <ArrowUpRight className="dx-kpi-go" size={16} aria-hidden />
      </span>
      <strong>{value == null ? <span className="skeleton" /> : <Count value={value} duration={900} />}</strong>
      <small>{note || ' '}</small>
      <span className="dx-kpi-viz">{children}</span>
    </Tag>
  )
}

// The period's days so far as a small filled line
function Spark({ days, k }) {
  if (!days) return null
  const past = days.filter((d) => d.day <= today())
  const pts = past.length > 1 ? past : days
  const top = Math.max(1, ...pts.map((d) => d[k]))
  const n = pts.length
  const P = pts.map((d, i) => [n === 1 ? 50 : (i / (n - 1)) * 100, 46 - (d[k] / top) * 38])
  const line = smooth(P, 46)
  return (
    <svg className="dx-spark" viewBox="0 0 100 48" preserveAspectRatio="none" aria-hidden>
      <path className="a" d={`${line} L${P[n - 1][0]},48 L${P[0][0]},48 Z`} />
      <path className="l" d={line} />
    </svg>
  )
}

// Twenty pills, lit to a share
function Segments({ share }) {
  const on = Math.round(share * 20)
  return <span className="dx-segs" aria-hidden>{Array.from({ length: 20 }, (_, i) => <i key={i} className={i < on ? 'on' : ''} style={{ '--i': i }} />)}</span>
}

// The first few idle candidates as overlapping initials
function Faces({ names }) {
  if (!names) return null
  if (!names.length) return <span className="dx-faces"><span className="dx-face ok"><CheckCircle2 size={16} /></span></span>
  return (
    <span className="dx-faces" aria-hidden>
      {names.slice(0, 5).map((n, i) => <span key={n + i} className="dx-face" style={{ '--tone': toneOf(n), '--i': i }}>{initials(n)}</span>)}
      {names.length > 5 && <span className="dx-face more">+{names.length - 5}</span>}
    </span>
  )
}

const W = 600, H = 220
// Catmull-Rom through the points, written as cubic Béziers, so the line runs smooth
function smooth(pts, floor = H) {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]} h1` : ''
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? pts[i + 1]
    // clamped to the baseline so a curve between two zeros never dips below it
    const c1y = Math.min(floor, p1[1] + (p2[1] - p0[1]) / 6), c2y = Math.min(floor, p2[1] - (p3[1] - p1[1]) / 6)
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${c1y} ${p2[0] - (p3[0] - p1[0]) / 6},${c2y} ${p2[0]},${p2[1]}`
  }
  return d
}

// Two smooth lines on one count axis; pointing at (or tabbing to) a day shows its numbers
function TrendChart({ days, focus }) {
  const [hover, setHover] = useState(null)
  if (!days) return <div className="dx-chart-sk sk" aria-hidden />
  const n = days.length
  const top = Math.ceil(Math.max(4, ...days.map((d) => Math.max(d.submissions, d.interviews))) / 4) * 4
  // each day sits in the middle of its own column, so the hit areas and labels line up with the points
  const x = (i) => ((i + 0.5) / n) * W
  const y = (v) => H - (v / top) * (H - 8)
  // the lines stop at today: days still to come are not zeros
  const past = days.filter((d) => d.day <= today()).length
  const line = (key) => smooth(days.slice(0, past).map((d, i) => [x(i), y(d[key])]))
  const area = (key) => (past ? `${line(key)} L${x(past - 1)},${H} L${x(0)},${H} Z` : '')
  const t = { s: sum(days, 'submissions'), i: sum(days, 'interviews') }
  const shown = hover ?? days.findIndex((d) => d.day === (focus ?? ''))
  const h = shown >= 0 ? days[shown] : null
  const every = n > 16 ? 5 : 1
  return (
    <div className="dx-chart">
      <div className="dx-legend">
        <span><i className="sw-int" /> Interviews <b>{t.i}</b></span>
        <span><i className="sw-sub" /> Submissions <b>{t.s}</b></span>
      </div>
      <div className="dx-plot" role="img" aria-label={`Daily submissions and interviews. ${t.s} submissions and ${t.i} interviews in total.`} onMouseLeave={() => setHover(null)}>
        <div className="dx-yaxis" aria-hidden>{[top, top / 2, 0].map((v) => <span key={v}>{v}</span>)}</div>
        <div className="dx-canvas">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id="dx-fill-int" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--c2)" stopOpacity="0.32" /><stop offset="1" stopColor="var(--c2)" stopOpacity="0" /></linearGradient>
              <linearGradient id="dx-fill-sub" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--c3)" stopOpacity="0.24" /><stop offset="1" stopColor="var(--c3)" stopOpacity="0" /></linearGradient>
            </defs>
            {[0, 0.5, 1].map((f) => <line key={f} className={`dx-gridline ${f === 1 ? 'base' : ''}`} x1="0" x2={W} y1={8 + f * (H - 8)} y2={8 + f * (H - 8)} />)}
            <path className="dx-area" d={area('submissions')} fill="url(#dx-fill-sub)" />
            <path className="dx-area" d={area('interviews')} fill="url(#dx-fill-int)" />
            <path className="dx-line sub" d={line('submissions')} />
            <path className="dx-line int" d={line('interviews')} />
          </svg>
          {past > 0 && !h && <i className="dx-dot int dx-now" style={{ left: `${(x(past - 1) / W) * 100}%`, top: `calc((100% - 28px) * ${y(days[past - 1].interviews) / H})` }} aria-hidden />}
          {h && (
            <div className="dx-cursor" style={{ left: `${(x(shown) / W) * 100}%` }} aria-hidden>
              <i className="dx-dot sub" style={{ top: `${(y(h.submissions) / H) * 100}%` }} />
              <i className="dx-dot int" style={{ top: `${(y(h.interviews) / H) * 100}%` }} />
              <div className={`dx-tip ${shown > (n - 1) * 0.6 ? 'left' : ''}`}>
                <b>{fmtDate(h.day)}</b>
                <span><i className="sw-int" /> {h.interviews} {plural(h.interviews, 'interview')}</span>
                <span><i className="sw-sub" /> {h.submissions} {plural(h.submissions, 'submission')}</span>
              </div>
            </div>
          )}
          <div className="dx-hits">
            {days.map((d, i) => (
              <button key={d.day} type="button" className={d.day === today() ? 'today' : ''} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                aria-label={`${fmtDate(d.day)}: ${d.submissions} submissions, ${d.interviews} interviews`}>
                <span>{i % every === 0 || i === n - 1 ? dayLabel(d.day, n) : ''}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// This period's interviews by status: a ring with the total in its middle, a labelled row per status
function Ring({ statuses }) {
  if (!statuses) return <div className="dx-ring-wrap" aria-busy="true"><span className="dx-ring-sk sk" /></div>
  const total = Object.values(statuses).reduce((a, b) => a + b, 0)
  if (!total) return <p className="empty-note">No interviews in this period yet</p>
  const shown = OUTCOMES.filter(([s]) => statuses[s])
  const gap = shown.length > 1 ? 1.4 : 0
  let at = 0
  return (
    <div className="dx-ring-wrap">
      <div className="dx-ring" role="img" aria-label={OUTCOMES.map(([s]) => `${s} ${statuses[s] ?? 0}`).join(', ')}>
        <svg viewBox="0 0 120 120" aria-hidden>
          <circle className="dx-ring-track" cx="60" cy="60" r="50" pathLength="100" />
          {shown.map(([s, tone], i) => {
            const len = (statuses[s] / total) * 100
            const draw = Math.max(0.5, len - gap)
            const seg = <circle key={s} className={`dx-ring-seg seg--${tone}`} cx="60" cy="60" r="50" pathLength="100" strokeDasharray={`${draw} ${100 - draw}`} strokeDashoffset={-at} style={{ '--i': i }} />
            at += len
            return seg
          })}
        </svg>
        <div className="dx-ring-mid"><b>{total}</b><span>{plural(total, 'interview')}</span></div>
      </div>
      <ul className="dx-ring-legend">
        {OUTCOMES.map(([s, tone]) => (
          <li key={s} className={statuses[s] ? '' : 'zero'}><i className={`seg--${tone}`} aria-hidden /><span>{s}</span><b>{statuses[s] ?? 0}</b><small>{pct(statuses[s] ?? 0, total)}%</small></li>
        ))}
      </ul>
    </div>
  )
}

function Leaderboard({ rows }) {
  if (!rows) return <ol className="dx-board" aria-busy="true">{[0, 1, 2, 3].map((i) => <li key={i}><span className="sk dx-av-sk" /><div className="dx-board-main"><SkeletonLine width="40%" /><SkeletonLine width="80%" height={6} /></div></li>)}</ol>
  if (!rows.length) return <p className="empty-note">Add recruiters to see activity</p>
  const max = Math.max(1, ...rows.map((r) => r.interviews))
  return (
    <ol className="dx-board">
      {rows.map((r, i) => (
        <li key={r.recruiter_id} className={i === 0 && r.interviews > 0 ? 'first' : ''}>
          <span className="dx-rank" aria-label={`Rank ${i + 1}`}>{i + 1}</span>
          <span className="dx-av" style={{ '--tone': toneOf(r.recruiter_name) }} aria-hidden>{initials(r.recruiter_name)}</span>
          <div className="dx-board-main">
            <div className="dx-board-top">
              <a className="row-link" href={`#recruiters/${r.recruiter_id}`}><strong className="nowrap">{r.recruiter_name}</strong></a>
              <span className="dx-board-nums"><b>{r.interviews}</b> {plural(r.interviews, 'interview')}<span> · {r.submissions} sent · {r.submissions ? `${pct(r.interviews, r.submissions)}%` : '—'}</span></span>
            </div>
            <i className="dx-meter" aria-hidden><span style={{ '--w': r.interviews / max, '--i': i }} /></i>
            {(r.interviewed.length > 0 || r.missed > 0) && (
              <div className="dx-board-sub">
                {r.interviewed.slice(0, 3).map(({ label: l, count }) => <span key={l} className="chip">{l}{count > 1 && <em>×{count}</em>}</span>)}
                {r.interviewed.length > 3 && <span className="chip">+{r.interviewed.length - 3} more</span>}
                {r.missed > 0 && <span className="dx-flag">{r.missed} idle</span>}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

function Upcoming({ rows }) {
  if (!rows) return <ol className="dx-time" aria-busy="true">{[0, 1, 2].map((i) => <li key={i}><span className="sk dx-date-sk" /><div className="dx-time-main"><SkeletonLine width="62%" /><SkeletonLine width="40%" height={12} /></div></li>)}</ol>
  if (!rows.length) return <p className="empty-note"><CalendarClock size={18} strokeWidth={1.5} /> No interviews scheduled ahead</p>
  return (
    <ol className="dx-time">
      {rows.map((r) => {
        const d = new Date(`${r.interview_date}T00:00:00`)
        const n = daysBetween(today(), r.interview_date)
        const s = r.submissions ?? {}
        return (
          <li key={r.id} className={n === 0 || n === 1 ? 'soon' : ''}>
            <span className="dx-date" aria-hidden><small>{d.toLocaleDateString('en-US', { month: 'short' })}</small><b>{d.getDate()}</b></span>
            <div className="dx-time-main">
              <strong>{s.candidates?.name}</strong>
              <span>{[s.companies?.name, r.round, s.recruiters?.name].filter(Boolean).join(' · ')}</span>
            </div>
            <span className="dx-when">{n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n === -1 ? 'Yesterday' : n < 0 ? `${-n} days ago` : `In ${n} days`}</span>
          </li>
        )
      })}
    </ol>
  )
}

function IdleList({ rows }) {
  if (!rows) return <div className="dx-idle-grid" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="dx-idle-card"><SkeletonLine width="50%" /><SkeletonLine width="70%" height={12} /></div>)}</div>
  if (!rows.length) return <p className="empty-note good"><CheckCircle2 size={18} strokeWidth={1.5} /> Every assigned candidate was submitted</p>
  return (
    <div className="dx-idle-grid">
      {rows.map((m) => {
        const days = m.last_submission ? daysBetween(m.last_submission, today()) : null
        return (
          <div key={m.candidate_id} className={`dx-idle-card ${days == null || days >= 14 ? 'long' : ''}`}>
            <div className="dx-idle-top">
              <span className="dx-av" style={{ '--tone': toneOf(m.candidate_name) }} aria-hidden>{initials(m.candidate_name)}</span>
              <div><strong>{m.candidate_name}</strong>{m.skill && <span>{m.skill}</span>}</div>
            </div>
            <div className="dx-idle-meta">
              <span>{m.recruiter_name}</span>
              <b>{days == null ? 'Never submitted' : `${days} ${plural(days, 'day')} idle`}</b>
            </div>
            <div className="row-actions">
              <button className="btn small" onClick={() => logSubmission({ recruiter_id: m.recruiter_id, candidate_id: m.candidate_id })} aria-label={`Log a submission for ${m.candidate_name}`}><Send size={14} /> Log submission</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Change({ now, was, than }) {
  const d = now - was
  if (d === 0) return <span><b>±0</b> vs {than}</span>
  return <span><b className={d > 0 ? 'up' : 'down'}>{d > 0 ? `+${d}` : `−${-d}`}</b> vs {than}</span>
}

// Two series on one count axis: submissions and interviews per day, side by side.
// Kept for the recruiter profile, which charts months with it.
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

// One stacked bar of this period's interviews by status, with a labelled row per status (recruiter profile)
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
