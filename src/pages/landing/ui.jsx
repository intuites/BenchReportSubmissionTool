// The product's own UI for the landing page, as live HTML in the app's look: the sidebar, figure
// tiles, tables, pills. Sample people are recruiters and candidates of a made-up bench; every count agrees.
import { Fragment, useLayoutEffect, useRef } from 'react'
import { BarChart3, Building2, CalendarCheck, FileBarChart, Mail, Pause, Play, Send, ShieldCheck, UserRound, Users } from 'lucide-react'
import { Count } from '../../stageshow/kit/motion/Count'
import { useInView } from './fx'

export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)
export const WEEK = { subs: 18, ints: 9, sel: 2, idle: 3 }
export const DAYS = [4, 3, 5, 2, 4, 0, 0].map((s, i) => ({ s, i: [2, 1, 2, 1, 3, 0, 0][i], x: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i] }))
export const TEAM = [['Abdul Rahman', 6, 3], ['Anshuman Mishra', 5, 3], ['Akhil Bansal', 4, 2], ['Farah Siddiqui', 3, 1]]
export const IDLE = [['Kavya Nair', 'Data engineer', 'Akhil Bansal', 12], ['Vikram Sethi', 'Java developer', 'Farah Siddiqui', 9], ['Zoya Khan', 'QA analyst', 'Anshuman Mishra', 8]]
export const SUBS = [
  ['Imran Sheikh', 'Java developer', 'Cognizant', '$65/hr C2C', 'Abdul Rahman', 2],
  ['Rohit Malhotra', 'DevOps engineer', 'Infosys', '$70/hr C2C', 'Abdul Rahman', 1],
  ['Tanvi Kulkarni', 'Business analyst', 'Capgemini', '$55/hr W2', 'Anshuman Mishra', 0],
  ['Arjun Reddy', 'Data engineer', 'Wipro', '$68/hr C2C', 'Akhil Bansal', 1],
  ['Meera Pillai', 'QA analyst', 'HCLTech', '$48/hr W2', 'Anshuman Mishra', 0],
  ['Sameer Qureshi', '.NET developer', 'Tech Mahindra', '$62/hr C2C', 'Farah Siddiqui', 1],
  ['Nisha Verma', 'Salesforce developer', 'Accenture', '$72/hr C2C', 'Akhil Bansal', 0],
]
export const NAV = [['Dashboard', BarChart3], ['Submissions', Send], ['Interviews', CalendarCheck], ['Candidates', UserRound], ['Recruiters', Users], ['Vendors', Building2], ['Follow-ups', Mail], ['Reports', FileBarChart], ['Team access', ShieldCheck]]
const initials = (n) => n.split(' ').map((w) => w[0]).join('')

export function Mark({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <rect x="2" y="2.5" width="20" height="5.5" rx="2.75" /><rect x="2" y="9.25" width="14" height="5.5" rx="2.75" /><rect x="2" y="16" width="8" height="5.5" rx="2.75" fill="var(--accent)" />
    </svg>
  )
}

// The app's sidebar, small; `active` is the page shown
export function Sidebar({ active, short }) {
  const items = short ? NAV.slice(0, 7) : NAV
  return (
    <div className="l-side" aria-hidden>
      <div className="l-side-logo"><Mark /> <b>Bench Tracker</b></div>
      {items.map(([label, Icon]) => <span key={label} className={label === active ? 'on' : ''}><Icon size={15} strokeWidth={1.6} />{label}</span>)}
    </div>
  )
}

export function PauseDisc({ paused, onToggle, label = 'Pause the animation' }) {
  return (
    <button type="button" className="l-pause" aria-pressed={paused} aria-label={paused ? 'Play the animation' : label} onClick={onToggle}>
      {paused ? <Play size={13} strokeWidth={2} /> : <Pause size={13} strokeWidth={2} />}
    </button>
  )
}

// Figure tiles; they count up from zero the first time they come into view
export function Figures({ f, roll = true }) {
  const [ref, inView] = useInView(0.4)
  const v = (n) => (roll && !inView ? 0 : n)
  return (
    <div className="l-figs" ref={ref}>
      <div className="l-fig"><span>Submissions</span><strong><Count value={v(f.subs)} duration={1000} /></strong></div>
      <div className="l-fig dark"><span>Interviews</span><strong><Count value={v(f.ints)} duration={1000} /></strong><small>{pct(f.ints, f.subs)}% hit rate</small></div>
      <div className="l-fig"><span>Selected</span><strong className="acc"><Count value={v(f.sel)} duration={1000} /></strong></div>
      <div className="l-fig"><span>Idle candidates</span><strong><Count value={v(f.idle)} duration={1000} /></strong></div>
    </div>
  )
}

// Daily bars that grow from the axis the first time they come into view
export function Bars({ days, max = 5 }) {
  const [ref, inView] = useInView(0.3)
  return (
    <div className="l-bars" ref={ref} data-in={inView || undefined}>
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

export function Avatar({ name }) { return <span className="l-avatar" aria-hidden>{initials(name)}</span> }

/*
  A heading whose lines rise out of word masks as it comes into view (scroll-driven where the browser
  can, else once by an observer). The words are the heading's own text; each knows its line for the stagger.
*/
export function Rise({ as: Tag = 'h2', text, className = '', ...rest }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    const set = () => {
      const words = [...el.querySelectorAll('.l-w')]
      const tops = [...new Set(words.map((w) => w.offsetTop))].sort((a, b) => a - b)
      words.forEach((w) => w.style.setProperty('--line', tops.indexOf(w.offsetTop)))
    }
    set()
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => ro.disconnect()
  }, [text])
  return (
    <Tag ref={ref} className={`l-rise ${className}`} {...rest}>
      {text.split(' ').map((w, i) => <Fragment key={i}>{i > 0 && ' '}<span className="l-w"><span>{w}</span></span></Fragment>)}
    </Tag>
  )
}

export { initials }
