/*
  The public landing page (signed-out visitors at # and #home), built with the taste skill.
  Kind: software. Deal: hero collage, nav-mega (built as plain anchors, the brief fixes the nav),
  footer-dark, close-type, rhythm dark-band, the app's own tonal buttons and stack mark.
  Moments dealt (moments.mjs pick --page software --count 2): letters-assemble on the idle
  statement, liquid-type on the closing headline. Their kit files live in public/landing/moments.
  Every colour is an app token, so the page follows the visitor's light or dark setting.
*/
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowRight, CalendarCheck, Check, FileSpreadsheet, FileText, Menu, Pause, Pencil, Play, Send, ShieldCheck, UserCheck, UserRound, X } from 'lucide-react'
import { Logo } from '../components/Logo'
import Segmented from '../components/Segmented'
import { Count } from '../stageshow/kit/motion/Count'
import { accentTokens } from '../lib/color'
import { ALL_ACCENTS } from '../lib/accents'
import { FONTS, fontHref } from '../lib/prefs'
import '../styles/landing.css'

const SECTIONS = [['submissions', 'Submissions'], ['dashboard', 'Dashboard'], ['follow-ups', 'Follow-ups'], ['reports', 'Reports'], ['access', 'Access']]
const reducedNow = () => document.documentElement.dataset.motion === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)

// One week of sample activity; the other periods are built to agree with it
const WEEK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const PERIODS = {
  day: {
    label: 'Today and the 13 days before',
    figures: { subs: 4, ints: 3, sel: 1, idle: 3 },
    days: [3, 4, 2, 5, 3, 0, 0, 4, 3, 5, 2, 4, 0, 4].map((s, i) => ({ s, i: [1, 2, 1, 2, 1, 0, 0, 2, 1, 2, 1, 3, 0, 3][i], x: i % 7 === 0 ? WEEK_LABELS[0] : '' })),
    outcomes: [1, 1, 1, 0, 0],
  },
  week: {
    label: 'This week',
    figures: { subs: 18, ints: 9, sel: 2, idle: 3 },
    days: [4, 3, 5, 2, 4, 0, 0].map((s, i) => ({ s, i: [2, 1, 2, 1, 3, 0, 0][i], x: WEEK_LABELS[i] })),
    outcomes: [2, 4, 1, 1, 1],
  },
  month: {
    label: 'This month',
    figures: { subs: 71, ints: 32, sel: 7, idle: 3 },
    days: Array.from({ length: 30 }, (_, d) => {
      const weekend = d % 7 === 5 || d % 7 === 6
      return { s: weekend ? 0 : [3, 4, 2, 5, 3][d % 5], i: weekend ? 0 : [1, 2, 1, 2, 1][(d + 2) % 5], x: d % 7 === 0 ? String(d + 1) : '' }
    }),
    outcomes: [7, 9, 8, 6, 2],
  },
}
const OUTCOMES = ['Selected', 'Scheduled', 'Completed', 'Rejected', 'No show']
const IDLE = [
  ['Kavya Nair', 'Data engineer', 'Akhil Bansal', 12],
  ['Vikram Sethi', 'Java developer', 'Farah Siddiqui', 9],
  ['Zoya Khan', 'QA analyst', 'Anshuman Mishra', 6],
]
const TEAM = [['Abdul Rahman', 6, 3, 1], ['Anshuman Mishra', 5, 3, 1], ['Akhil Bansal', 4, 2, 0], ['Farah Siddiqui', 3, 1, 0]]
const RULES = [1, 2, 3, 5, 7].map((n) => [n, `${n} day${n > 1 ? 's' : ''}`])
const SWATCHES = ['Card pink', 'Tomato', 'Amber', 'Mustard', 'Green', 'Jade', 'Teal', 'Ocean', 'Navy', 'Slate'].map((n) => ALL_ACCENTS.find(([name]) => name === n))
const TYPEFACES = ['host', 'fabric', 'schibsted', 'bricolage']

// The h1 rises line by line out of word masks, once on load (taste motion layer)
function EnterHeading({ id, text }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const words = [...ref.current.querySelectorAll('.l-w')]
    const tops = [...new Set(words.map((w) => w.offsetTop))].sort((a, b) => a - b)
    words.forEach((w) => w.style.setProperty('--line', tops.indexOf(w.offsetTop)))
  }, [])
  return (
    <h1 id={id} ref={ref} className="l-h1">
      {text.split(' ').map((w, i) => <Fragment key={i}>{i > 0 && ' '}<span className="l-w"><span>{w}</span></span></Fragment>)}
    </h1>
  )
}

function PauseDisc({ paused, onToggle }) {
  return (
    <button type="button" className="l-pause" aria-pressed={paused} aria-label="Pause the animation" onClick={onToggle}>
      {paused ? <Play size={14} strokeWidth={2} /> : <Pause size={14} strokeWidth={2} />}
    </button>
  )
}

// A card loop: restarts when the pointer arrives (not in its first 800ms), pauses on its disc
function useLoop() {
  const [run, setRun] = useState(0)
  const [paused, setPaused] = useState(false)
  const started = useRef(Date.now())
  const restart = () => {
    if (paused || Date.now() - started.current < 800) return
    started.current = Date.now()
    setRun((r) => r + 1)
  }
  return { run, paused, toggle: () => setPaused((p) => !p), restart }
}

function Bars({ days, max, grow }) {
  return (
    <div className="l-bars" data-grow={grow || undefined}>
      {days.map((d, k) => (
        <div className="l-day" key={k} style={{ '--d': k }}>
          <div className="l-pair">
            <i className="l-bar l-s" style={{ transform: `scaleY(${d.s / max})` }} />
            <i className="l-bar l-i" style={{ transform: `scaleY(${d.i / max})` }} />
          </div>
          <span className="l-x" data-short={/^\d/.test(d.x) ? d.x : d.x.slice(0, 1)}><span>{d.x}</span></span>
        </div>
      ))}
    </div>
  )
}

function Figures({ f }) {
  return (
    <div className="l-figs">
      <div className="l-fig"><span>Submissions</span><strong><Count value={f.subs} duration={900} /></strong></div>
      <div className="l-fig dark"><span>Interviews</span><strong><Count value={f.ints} duration={900} /></strong><small>{pct(f.ints, f.subs)}% hit rate</small></div>
      <div className="l-fig"><span>Selected</span><strong className="acc"><Count value={f.sel} duration={900} /></strong></div>
      <div className="l-fig"><span>Idle candidates</span><strong><Count value={f.idle} duration={900} /></strong></div>
    </div>
  )
}

// The hero's product window: the real dashboard, small. Figures count up and bars grow once on load
function HeroWindow() {
  const week = PERIODS.week
  const [f, setF] = useState(() => (reducedNow() ? week.figures : { subs: 0, ints: 0, sel: 0, idle: 0 }))
  useEffect(() => { const t = setTimeout(() => setF(week.figures), 350); return () => clearTimeout(t) }, [])
  return (
    <div className="l-window l-hero-window" data-ui role="img" aria-label="The Bench Tracker dashboard: 18 submissions and 9 interviews this week, 2 selected, 3 idle candidates">
      <div className="l-win-bar"><b>Dashboard</b><span>This week</span><em>Weekly</em></div>
      <div className="l-win-body">
        <Figures f={f} />
        <div className="l-win-row">
          <div className="l-win-card">
            <div className="l-win-head"><b>Daily activity</b><span className="l-key"><i className="l-s" /> Submissions <i className="l-i" /> Interviews</span></div>
            <Bars days={week.days} max={5} grow />
          </div>
          <div className="l-win-card">
            <div className="l-win-head"><b>Idle candidates</b></div>
            <ul className="l-idle">
              {IDLE.map(([name, , , days]) => <li key={name}><span>{name}</span><em>{days} days</em></li>)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

// The one result card over the window: a submission, its interview, the outcome
function HeroCard() {
  const loop = useLoop()
  return (
    <div className="l-float" onPointerEnter={loop.restart} data-paused={loop.paused || undefined}>
      <div className="l-float-head"><b>Submission logged</b><PauseDisc paused={loop.paused} onToggle={loop.toggle} /></div>
      <ol key={loop.run} className="l-steps" aria-label="Imran Sheikh submitted to Cognizant, interview scheduled, selected">
        <li style={{ '--k': 0 }}><Send size={15} strokeWidth={1.75} /><span><b>Imran Sheikh to Cognizant</b><small>Java developer · $65/hr C2C</small></span></li>
        <li style={{ '--k': 1 }}><CalendarCheck size={15} strokeWidth={1.75} /><span><b>Interview scheduled</b><small>Client round 1 · Thursday</small></span></li>
        <li style={{ '--k': 2 }}><Check size={15} strokeWidth={2} /><span><b>Selected</b><small>Counted on Abdul Rahman’s report</small></span></li>
      </ol>
    </div>
  )
}

function SubmissionRecord() {
  const loop = useLoop()
  return (
    <div className="l-window l-record" onPointerEnter={loop.restart} data-paused={loop.paused || undefined}>
      <div className="l-win-bar"><b>Submission</b><span>Tuesday</span><PauseDisc paused={loop.paused} onToggle={loop.toggle} /></div>
      <div className="l-win-body" role="img" aria-label="A submission of Imran Sheikh to Cognizant at $65/hr C2C by Abdul Rahman, with three interviews: technical screen and client round 1 completed, client round 2 selected">
        <dl className="l-fields">
          <div><dt>Candidate</dt><dd>Imran Sheikh<small>Java developer</small></dd></div>
          <div><dt>Company / vendor</dt><dd>Cognizant<small>Bench sales vendor</small></dd></div>
          <div><dt>Submitted rate</dt><dd>$65/hr C2C</dd></div>
          <div><dt>Recruiter</dt><dd>Abdul Rahman</dd></div>
          <div className="wide"><dt>Job title / requirement</dt><dd>Senior Java developer, Spring Boot and Kafka</dd></div>
        </dl>
        <div className="l-win-head"><b>Interviews</b><span>3</span></div>
        <ul key={loop.run} className="l-ivs">
          <li><span><b>Technical screen</b><small>Friday</small></span><em className="l-pill">Completed</em></li>
          <li><span><b>Client round 1</b><small>Monday</small></span><em className="l-pill">Completed</em></li>
          <li><span><b>Client round 2</b><small>Thursday</small></span><span className="l-turn"><em className="l-pill">Scheduled</em><em className="l-pill strong">Selected</em></span></li>
        </ul>
      </div>
    </div>
  )
}

function DashboardDemo() {
  const [period, setPeriod] = useState('week')
  const p = PERIODS[period]
  const total = p.outcomes.reduce((a, b) => a + b, 0)
  return (
    <div className="l-window l-dash" data-visual data-ui>
      <div className="l-win-bar">
        <b>Dashboard</b><span>{p.label}</span>
        <Segmented label="Report period" items={[['day', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly']]} value={period} onChange={setPeriod} />
      </div>
      <div className="l-win-body">
        <Figures f={p.figures} />
        <div className="l-dash-row">
          <div className="l-win-card">
            <div className="l-win-head"><b>Daily activity</b><span className="l-key"><i className="l-s" /> Submissions {p.figures.subs} <i className="l-i" /> Interviews {p.figures.ints}</span></div>
            <Bars days={p.days} max={5} />
          </div>
          <div className="l-win-card">
            <div className="l-win-head"><b>Interview outcomes</b><span>{total} this period</span></div>
            <div className="l-outbar" aria-hidden>{OUTCOMES.map((o, k) => <i key={o} className={`o${k}`} style={{ flexGrow: p.outcomes[k] }} />)}</div>
            <ul className="l-outs">
              {OUTCOMES.map((o, k) => <li key={o}><i className={`o${k}`} />{o}<b>{p.outcomes[k]}</b></li>)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function EmailDemo() {
  const [days, setDays] = useState(7)
  return (
    <div className="l-split">
      <div className="l-text">
        <h2 className="l-h2">Follow-up emails for idle bench candidates</h2>
        <p className="l-lead">A candidate is idle after the days without a submission an admin sets. Bench Tracker then emails the recruiter who has them.</p>
        <dl className="l-facts">
          <div><dt>When</dt><dd>Weekdays at 14:00 UTC</dd></div>
          <div><dt>What</dt><dd>One email per recruiter, naming each idle candidate</dd></div>
        </dl>
        <div className="l-control">
          <span className="l-label" id="rule-label">Idle after</span>
          <Segmented label="Idle after" items={RULES} value={days} onChange={setDays} />
        </div>
      </div>
      <div className="l-panel l-panel--email" data-visual>
        <article className="l-window l-email" aria-label="The follow-up email" data-ui>
          <dl className="l-email-meta">
            <dt>From</dt><dd>Bench Tracker</dd>
            <dt>To</dt><dd>Akhil Bansal</dd>
            <dt>Subject</dt><dd><strong>Update needed: no submissions for Kavya Nair in 12 days</strong></dd>
          </dl>
          <div className="l-email-body">
            <p>Hi Akhil Bansal,</p>
            <p>These candidates assigned to you have had no submissions for <mark key={days} className="l-flash">{days} day{days > 1 ? 's' : ''}</mark> or more:</p>
            <ul><li><strong>Kavya Nair</strong> (Data engineer): no submissions in 12 days</li></ul>
            <p>Please reply with an update: why no submissions were made, and your plan for each candidate.</p>
            <p className="l-sign">Bench Tracker</p>
          </div>
        </article>
      </div>
    </div>
  )
}

function AccessDemo() {
  const [roles, setRoles] = useState({})
  const list = useRef(null)
  const moved = useRef(null)
  // the clicked buttons unmount, so keep keyboard focus on the row's new first button
  useEffect(() => { if (moved.current != null) list.current.children[moved.current]?.querySelector('button')?.focus() }, [roles])
  const people = [['Farah Siddiqui', 'Signed up Monday'], ['Anshuman Mishra', 'Signed up Tuesday']]
  return (
    <div className="l-window l-approvals" data-visual data-ui>
      <div className="l-win-bar"><b>Team access</b><span>Waiting {people.filter(([n]) => !roles[n]).length}</span></div>
      <ul className="l-people" ref={list}>
        {people.map(([name, when], k) => {
          const role = roles[name]
          const set = (r) => { moved.current = k; setRoles((x) => ({ ...x, [name]: r })) }
          return (
            <li key={name}>
              <span className="l-avatar" aria-hidden>{name.split(' ').map((w) => w[0]).join('')}</span>
              <span className="l-who"><b>{name}</b><small>{when}</small></span>
              {role ? (
                <span className="l-done" key={role}>
                  <em className={`l-pill ${role === 'Admin' ? 'strong' : ''}`}>{role}</em>
                  <button type="button" className="l-textbtn" onClick={() => set(null)} aria-label={`Undo, ${name} waits again`}>Undo</button>
                </span>
              ) : (
                <span className="l-acts">
                  <button type="button" className="btn small" onClick={() => set('Recruiter')} aria-label={`Approve ${name} as recruiter`}><UserCheck size={14} /> Approve as recruiter</button>
                  <button type="button" className="btn small ghost" onClick={() => set('Admin')} aria-label={`Make ${name} an admin`}><ShieldCheck size={14} /> Make admin</button>
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// The visitor's light or dark mode, so the preview takes the accent's tested shades for it
function useDark() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark')
  useEffect(() => {
    const mo = new MutationObserver(() => setDark(document.documentElement.dataset.theme === 'dark'))
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => mo.disconnect()
  }, [])
  return dark
}

function AppearanceDemo() {
  const [accent, setAccent] = useState(SWATCHES[0])
  const [face, setFace] = useState('host')
  const dark = useDark()
  const t = accentTokens(accent[1], dark)
  const pickFace = (id) => {
    const f = FONTS[id]
    if (!f.local && !document.getElementById(`l-font-${id}`)) document.head.append(Object.assign(document.createElement('link'), { id: `l-font-${id}`, rel: 'stylesheet', href: fontHref([id]) }))
    setFace(id)
  }
  const style = {
    '--accent': t.accent, '--accent-hover': t.hover, '--accent-mark': t.mark, '--accent-ink': t.ink, '--accent-soft': t.soft, '--on-accent': t.on,
    '--font-display': `'${FONTS[face].name}', system-ui, sans-serif`, '--font-body': `'${FONTS[face].name}', system-ui, sans-serif`,
  }
  return (
    <div className="l-split">
      <div className="l-text">
        <h2 className="l-h2">Each team member’s own colour and typeface</h2>
        <p className="l-lead">Each person picks one of 50 accents and 18 typefaces, in light, dark or the system’s mode. Every accent is tested to read in both.</p>
        <div className="l-control">
          <span className="l-label" id="accent-label">Accent</span>
          <div className="l-swatches" role="radiogroup" aria-labelledby="accent-label">
            {SWATCHES.map(([name, hex]) => (
              <button key={name} type="button" role="radio" aria-checked={accent[0] === name} aria-label={name} title={name} className="l-swatch" style={{ '--sw': hex }} onClick={() => setAccent([name, hex])} />
            ))}
          </div>
        </div>
        <div className="l-control">
          <span className="l-label" id="face-label">Typeface</span>
          <div className="l-faces" role="radiogroup" aria-labelledby="face-label">
            {TYPEFACES.map((id) => (
              <button key={id} type="button" role="radio" aria-checked={face === id} className="l-face" onClick={() => pickFace(id)}>{FONTS[id].name}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="l-panel l-panel--pref" data-visual>
        <div className="l-window l-preview" data-ui style={style} role="img" aria-label={`The dashboard in ${accent[0]} with ${FONTS[face].name}`}>
          <div className="l-win-bar"><b>Dashboard</b><span>{accent[0]} · {FONTS[face].name}</span></div>
          <div className="l-win-body">
            <div className="l-prev-head"><strong>This week</strong><span className="l-fake-btn"><Send size={14} /> Log submission</span></div>
            <Figures f={PERIODS.week.figures} />
            <div className="l-win-card">
              <div className="l-win-head"><b>Daily activity</b><span className="l-key"><i className="l-s" /> Submissions <i className="l-i" /> Interviews</span></div>
              <Bars days={PERIODS.week.days} max={5} />
            </div>
            <div className="l-prev-pills"><em className="l-pill strong">Selected</em><em className="l-pill">Scheduled</em><em className="l-pill">Completed</em></div>
          </div>
        </div>
      </div>
    </div>
  )
}

// The kit's moment loader (public/landing/moments), mounted on this page's own sections
function useMoments(refs) {
  useEffect(() => {
    if (reducedNow()) return
    let alive = true, mod = null
    const els = refs.map((r) => r.current).filter(Boolean)
    const texts = els.map((el) => [...el.querySelectorAll('.mo-la__type')].map((h) => [h, h.textContent]))
    window.__momentsManual = true
    import(/* @vite-ignore */ new URL('/landing/moments/moments.js', location.origin).href)
      .then((m) => { mod = m; if (alive) els.forEach((el) => m.mount(el)) })
      .catch(() => {})
    return () => {
      alive = false
      els.forEach((el) => mod?.unmountAll(el.parentElement || el))
      // letters-assemble split the statement into letters: give React its words back
      texts.flat().forEach(([h, text]) => { h.textContent = text; h.removeAttribute('aria-label') })
    }
  }, [])
}

export default function Landing() {
  const [menu, setMenu] = useState(false)
  const statementRef = useRef(null)
  const closeRef = useRef(null)
  useMoments([statementRef, closeRef])

  // Arriving at #dashboard (or another section) signed out: go to that section
  useEffect(() => {
    const id = location.hash.slice(1)
    if (id && id !== 'home' && document.getElementById(id)) document.getElementById(id).scrollIntoView()
  }, [])

  useEffect(() => {
    if (!menu) return
    const onKey = (e) => e.key === 'Escape' && setMenu(false)
    window.addEventListener('keydown', onKey)
    document.documentElement.classList.add('l-locked')
    return () => { window.removeEventListener('keydown', onKey); document.documentElement.classList.remove('l-locked') }
  }, [menu])

  // In-page links scroll smoothly and leave the hash alone (the hash routes this app)
  const onClick = (e) => {
    const a = e.target.closest('a[href^="#"]')
    if (!a) return
    const id = a.getAttribute('href').slice(1)
    const el = id && document.getElementById(id)
    if (!el || !e.currentTarget.contains(el)) { setMenu(false); return }
    e.preventDefault()
    setMenu(false)
    el.scrollIntoView({ behavior: reducedNow() ? 'auto' : 'smooth', block: 'start' })
    el.focus({ preventScroll: true })
  }

  const year = new Date().getFullYear()
  return (
    <div className="landing" onClick={onClick}>
      <header className="l-nav">
        <div className="wrap l-wrap">
          <a className="l-skip" href="#main">Skip to content</a>
          <a href="#top" className="l-logo" aria-label="Bench Tracker home"><Logo /></a>
          <nav className="l-links" aria-label="Sections">
            {SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`} className="l-navlink">{label}</a>)}
          </nav>
          <div className="l-nav-end">
            <a href="#signin" className="l-navlink l-signin">Sign in</a>
            <a href="#signup" className="btn primary l-nav-cta">Create an account</a>
            <button type="button" className="l-menu-btn" aria-expanded={menu} aria-controls="l-sheet" aria-label={menu ? 'Close the menu' : 'Open the menu'} onClick={() => setMenu((m) => !m)}>
              {menu ? <X size={20} strokeWidth={1.75} /> : <Menu size={20} strokeWidth={1.75} />}
            </button>
          </div>
        </div>
      </header>
      {menu && (
        <div className="l-sheet" id="l-sheet" onClick={() => setMenu(false)}>
          <nav aria-label="Menu" className="wrap l-wrap">
            {[...SECTIONS, ['appearance', 'Appearance']].map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
            <a href="#signin">Sign in</a>
            <a href="#signup" className="btn primary">Create an account</a>
          </nav>
        </div>
      )}

      <main id="main" tabIndex={-1}>
        <section className="l-hero" id="top" tabIndex={-1} data-enter aria-labelledby="hero-h">
          <div className="wrap l-wrap">
           <div className="hero-text l-hero-grid">
            <div className="l-hero-text">
              <EnterHeading id="hero-h" text="Submission tracker for bench sales teams" />
              <div className="l-follow">
                <p className="l-lead" style={{ '--i': 0 }}>Log every candidate you send to a vendor and the interviews each submission earns. Recruiters with idle candidates get an email weekdays at 14:00 UTC.</p>
                <div className="l-btns" style={{ '--i': 1 }}>
                  <a href="#signup" className="btn primary">Create an account <ArrowRight className="l-arrow" size={16} strokeWidth={2} /></a>
                  <a href="#dashboard" className="btn">See the dashboard</a>
                </div>
                <p className="l-proof" style={{ '--i': 2 }}>An admin approves every new account.</p>
              </div>
            </div>
            <div className="l-hero-art" data-visual>
              <HeroWindow />
              <HeroCard />
            </div>
           </div>
          </div>
        </section>

        <section className="l-sec" id="submissions" tabIndex={-1} aria-labelledby="sub-h">
          <div className="wrap l-wrap l-split">
            <div className="l-text">
              <h2 className="l-h2" id="sub-h">Submissions with their interviews attached</h2>
              <p className="l-lead">Each submission records who sent which candidate to which vendor, at what rate. Interviews are logged against it, so every hit rate is counted.</p>
              <dl className="l-facts">
                <div><dt>A submission</dt><dd>Date, recruiter, candidate, vendor and its recruiter, rate, job title</dd></div>
                <div><dt>An interview</dt><dd>Date, round and status: scheduled, completed, selected, rejected or no show</dd></div>
              </dl>
            </div>
            <div className="l-panel l-panel--record" data-visual><SubmissionRecord /></div>
          </div>
        </section>

        <section className="l-sec l-band" id="dashboard" tabIndex={-1} aria-labelledby="dash-h">
          <div className="wrap l-wrap">
            <h2 className="l-h2" id="dash-h">A dashboard of submissions and interviews</h2>
            <p className="l-lead">Four figures, the daily activity and how interviews turned out. Pick a period and the figures roll to it.</p>
            <DashboardDemo />
          </div>
        </section>

        <section className="l-sec l-statement" ref={statementRef} data-moment="letters-assemble" aria-labelledby="idle-h">
          <div className="wrap l-wrap">
            <h2 className="mo-la__type l-h2" id="idle-h">Idle bench candidates, by name</h2>
            <p className="mo-la__sub">The dashboard lists every candidate with no submission in the period, beside the recruiter who has them.</p>
            <ul className="l-idle-big">
              {IDLE.map(([name, skill, rec, days]) => <li key={name}><b>{name}</b><span>{skill}</span><span>{rec}</span><em>{days} days idle</em></li>)}
            </ul>
          </div>
        </section>

        <section className="l-sec" id="follow-ups" tabIndex={-1}>
          <div className="wrap l-wrap"><EmailDemo /></div>
        </section>

        <section className="l-sec" id="reports" tabIndex={-1} aria-labelledby="rep-h">
          <div className="wrap l-wrap">
            <h2 className="l-h2" id="rep-h">Recruiter profiles and the team report</h2>
            <p className="l-lead">For admins: every recruiter’s numbers for any period. Each recruiter has a profile, and admins edit it.</p>
            <div className="l-bento">
              <article className="l-card l-card--wide">
                <h3>Exports the team report</h3>
                <p>Submissions, interviews, hit rate and outcomes per recruiter, as a PDF to print or an Excel file.</p>
                <div className="l-card-panel" data-visual>
                  <div className="l-window l-report" data-ui role="img" aria-label="The team report with its export menu open: PDF or Excel">
                    <div className="l-win-bar"><b>Reports</b><span>This week</span><em className="l-export">Export</em></div>
                    <div className="l-menu-pop" aria-hidden>
                      <span><FileText size={16} strokeWidth={1.5} /><b>PDF</b><small>A printable report</small></span>
                      <span><FileSpreadsheet size={16} strokeWidth={1.5} /><b>Excel</b><small>A spreadsheet (.xlsx)</small></span>
                    </div>
                    <div className="l-table">
                      <div className="l-tr l-th"><span>Recruiter</span><span>Submissions</span><span>Interviews</span><span>Hit rate</span></div>
                      {TEAM.map(([n, s, i]) => <div className="l-tr" key={n}><span>{n}</span><span>{s}</span><span>{i}</span><span>{pct(i, s)}%</span></div>)}
                      <div className="l-tr l-total"><span>Team total</span><span>18</span><span>9</span><span>50%</span></div>
                    </div>
                  </div>
                </div>
              </article>
              <article className="l-card">
                <h3>Recruiter profiles with every submission</h3>
                <p>Name, email and active status, with each candidate’s submissions and interviews.</p>
                <div className="l-card-panel" data-visual>
                  <div className="l-window l-profile" data-ui role="img" aria-label="Abdul Rahman's recruiter profile with three candidates">
                    <div className="l-prof-head"><span className="l-avatar" aria-hidden>AR</span><span className="l-who"><b>Abdul Rahman</b><small>Recruiter · active</small></span><span className="l-fake-btn ghost"><Pencil size={13} /> Edit</span></div>
                    <ul className="l-cands">
                      <li><span><b>Imran Sheikh</b><small>Java developer</small></span><em>2 interviews</em></li>
                      <li><span><b>Rohit Malhotra</b><small>DevOps engineer</small></span><em>1 interview</em></li>
                      <li><span><b>Tanvi Kulkarni</b><small>Business analyst</small></span><em>3 submissions</em></li>
                    </ul>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="l-sec" id="access" tabIndex={-1} aria-labelledby="acc-h">
          <div className="wrap l-wrap">
            <h2 className="l-h2" id="acc-h">Team access, approved by an admin</h2>
            <p className="l-lead">Anyone can sign up with a work email. They see nothing until an admin gives them one role: recruiter or admin.</p>
            <div className="l-access">
              <AccessDemo />
              <dl className="l-roles">
                <div><dt><UserRound size={18} strokeWidth={1.5} /> Recruiter</dt><dd>Logs submissions and interviews, and works from the dashboard, candidates, vendors and follow-ups.</dd></div>
                <div><dt><ShieldCheck size={18} strokeWidth={1.5} /> Admin</dt><dd>The whole app: everything a recruiter has, plus reports, editing recruiter profiles, the follow-up rule and team access.</dd></div>
              </dl>
            </div>
          </div>
        </section>

        <section className="l-sec" id="appearance" tabIndex={-1}>
          <div className="wrap l-wrap"><AppearanceDemo /></div>
        </section>
      </main>

      <footer className="closing l-closing" id="contact">
        <div className="wrap l-wrap">
          <div className="l-close" ref={closeRef} data-moment="liquid-type">
            <h2 className="mo-lt__type l-close-h">Bench Tracker for your team</h2>
            <p className="l-lead">Create an account with your work email. Once an admin approves it, you start logging.</p>
            <a href="#signup" className="btn primary l-xl">Create an account <ArrowRight className="l-arrow" size={18} strokeWidth={2} /></a>
          </div>
          <div className="l-foot">
            <a href="#top" className="l-foot-name" aria-label="Bench Tracker, back to the top"><Logo /></a>
            <nav className="l-foot-cols" aria-label="Footer">
              <div className="l-foot-product"><h3>Product</h3><div>{[...SECTIONS, ['appearance', 'Appearance']].map(([id, label]) => <a key={id} href={`#${id}`} className="l-navlink">{label}</a>)}</div></div>
              <div><h3>Account</h3><a href="#signin" className="l-navlink">Sign in</a><a href="#signup" className="l-navlink">Create an account</a></div>
            </nav>
            <p className="l-legal">Bench Tracker · {year}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
