import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { BarChart3, Building2, CalendarCheck, Compass, FileBarChart, LogOut, Mail, Monitor, Moon, MoreHorizontal, Palette, Send, ShieldCheck, Sun, UserRound, Users } from 'lucide-react'
import { Splash } from './components/Loading'
import { supabase } from './lib/supabase'
import { usePrefs } from './lib/prefs'
import ErrorBoundary from './components/ErrorBoundary'
import { Logo } from './components/Logo'
import { ConfirmHost, confirmDialog } from './components/Confirm'
import Glass from './components/Glass'
import { Liquid, useActiveRect } from './components/Liquid'
import Login from './pages/Login'
import Landing from './pages/Landing'
import Tour from './components/Tour'
import ProfileMenu from './components/ProfileMenu'
import AccessPending from './pages/AccessPending'
import Team from './pages/Team'
import Dashboard from './pages/Dashboard'
import Submissions from './pages/Submissions'
import Interviews from './pages/Interviews'
import Recruiters from './pages/Recruiters'
import Candidates from './pages/Candidates'
import Vendors from './pages/Vendors'
import Settings from './pages/Settings'
import Reports from './pages/Reports'
import Appearance from './pages/Appearance'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3, Page: Dashboard },
  { id: 'submissions', label: 'Submissions', icon: Send, Page: Submissions },
  { id: 'interviews', label: 'Interviews', icon: CalendarCheck, Page: Interviews },
  { id: 'candidates', label: 'Candidates', icon: UserRound, Page: Candidates },
  { id: 'recruiters', label: 'Recruiters', icon: Users, Page: Recruiters },
  { id: 'vendors', label: 'Vendors', icon: Building2, Page: Vendors },
  { id: 'followups', label: 'Follow-ups', icon: Mail, Page: Settings },
  { id: 'reports', label: 'Reports', icon: FileBarChart, Page: Reports, admin: true },
  { id: 'team', label: 'Team access', icon: ShieldCheck, Page: Team, admin: true },
  // in the profile menu (and More on a phone), not the sidebar
  { id: 'appearance', label: 'Appearance', icon: Palette, Page: Appearance, menu: true },
]

const PHONE_TABS = ['dashboard', 'submissions', 'interviews', 'candidates']
// #page or #page/param, e.g. #recruiters/<id> opens that recruiter's profile
const fromHash = () => NAV.find((n) => n.id === location.hash.slice(1).split('/')[0])?.id || 'dashboard'
const paramFromHash = () => { try { return decodeURIComponent(location.hash.slice(1).split('/')[1] || '') } catch { return '' } }
const MODES = { system: [Monitor, 'light'], light: [Sun, 'dark'], dark: [Moon, 'system'] }

// Signed out: the landing page at #, or #home; the sign-in card at #signin and #signup
function PublicSite() {
  const read = () => location.hash.slice(1).split('/')[0]
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const on = () => { setRoute(read()); if (!['signin', 'signup'].includes(read())) window.scrollTo({ top: 0, behavior: 'instant' }) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  if (route === 'signin' || route === 'signup') return <Login key={route} initialMode={route} />
  return <Landing />
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [page, setPage] = useState(fromHash)
  const [param, setParam] = useState(paramFromHash)
  const { prefs, reveal, reduced, setUser } = usePrefs()
  const navRef = useRef(null)
  const [member, setMember] = useState(undefined)
  const navRect = useActiveRect(navRef, `${page}-${member ? 1 : 0}`)
  // Phones show four tabs and More; More opens the rest of the pages in a sheet
  const [moreOpen, setMoreOpen] = useState(false)
  const [touring, setTouring] = useState(false)
  useEffect(() => setMoreOpen(false), [page])
  useEffect(() => {
    if (!moreOpen) return
    const onKey = (e) => e.key === 'Escape' && setMoreOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [moreOpen])

  useEffect(() => {
    if (!supabase) return setSession(null)
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  // Signed in isn't enough: the database decides who is on the team
  const [admin, setAdmin] = useState({ is: false, waiting: 0 })
  const checkMember = async () => {
    const [m, a] = await Promise.all([supabase.rpc('bt_is_member'), supabase.rpc('bt_is_admin')])
    const isAdmin = !a.error && a.data === true
    let waiting = 0
    if (isAdmin) {
      const { data } = await supabase.rpc('bt_accounts')
      waiting = (data || []).filter((r) => r.confirmed && !r.is_admin && !r.recruiter_active).length
    }
    setAdmin({ is: isAdmin, waiting })
    setMember(m.error ? false : m.data === true)
  }
  const userId = session?.user?.id
  useEffect(() => setUser(userId ?? null), [userId])
  useEffect(() => {
    setMember(undefined)
    if (userId) checkMember()
  }, [userId])

  // Page changes cross-fade with the View Transitions API where supported
  useEffect(() => {
    const onHash = () => {
      const next = fromHash()
      const nextParam = paramFromHash()
      const swap = () => flushSync(() => { setPage(next); setParam(nextParam) })
      // no cross-fade while the tour runs: snapshotting the page under it is what made it stutter
      if (document.startViewTransition && !reduced && !('touring' in document.documentElement.dataset)) {
        // The content area is named only while the change animates
        const root = document.documentElement
        root.dataset.vt = 'page'
        const t = document.startViewTransition(swap)
        t.ready.catch(() => {}) // skipped when another change starts first; the page still swaps
        t.finished.finally(() => { if (root.dataset.vt === 'page') delete root.dataset.vt })
      } else swap()
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [reduced])

  // Signing out always asks first
  async function signOut() {
    const ok = await confirmDialog('Sign out of Bench Tracker?', { body: 'You will need your email and password to sign back in.', confirm: 'Sign out', cancel: 'Stay signed in' })
    if (ok) supabase.auth.signOut()
  }

  if (session === undefined) return <Splash />

  const [ModeIcon, nextMode] = MODES[prefs.mode]
  const chrome = <ConfirmHost />

  if (!session) return <>{chrome}<PublicSite /></>
  if (member === undefined) return <>{chrome}<Splash /></>
  if (!member) return <>{chrome}<AccessPending email={session.user.email} onRetry={checkMember} /></>

  const nav = NAV.filter((n) => !n.admin || admin.is)
  const { Page } = nav.find((n) => n.id === page) || nav[0]
  return (
    <div className="shell">
      {chrome}
      <Glass as="aside" className="sidebar">
        <Logo />
        <nav ref={navRef}>
          <Liquid rect={navRect} tone="accent" />
          {nav.filter((n) => !n.menu).map(({ id, label, icon: Icon }) => (
            <a key={id} href={`#${id}`} data-active={page === id} className={`${page === id ? 'active' : ''} ${PHONE_TABS.includes(id) ? '' : 'nav-more'}`} aria-current={page === id ? 'page' : undefined} aria-label={id === 'team' && admin.waiting ? `${label}, ${admin.waiting} waiting` : label} title={label}>
              <Icon size={18} strokeWidth={1.5} /> <span>{label}</span>{id === "team" && admin.waiting > 0 && <b className="nav-badge" aria-label={`${admin.waiting} waiting`}>{admin.waiting}</b>}
            </a>
          ))}
          <button type="button" className="more-btn" data-active={!PHONE_TABS.includes(page)} aria-expanded={moreOpen} aria-label="More pages" onClick={() => setMoreOpen((o) => !o)}>
            <MoreHorizontal size={20} strokeWidth={1.5} />{admin.waiting > 0 && <i className="more-dot" aria-hidden />}
          </button>
        </nav>
        <div className="me">
          <ProfileMenu
            email={session.user.email}
            name={session.user.user_metadata?.full_name}
            role={admin.is ? 'admin' : 'recruiter'}
            onTour={() => setTouring(true)}
            onTheme={(e) => reveal({ mode: nextMode }, e)}
            themeLabel={`${prefs.mode[0].toUpperCase()}${prefs.mode.slice(1)}, switch to ${nextMode}`}
            ThemeIcon={ModeIcon}
            onSignOut={signOut}
          />
        </div>
      </Glass>
      {moreOpen && (
        <div className="more-sheet" onClick={() => setMoreOpen(false)}>
          <nav className="more-panel" aria-label="More pages" onClick={(e) => e.stopPropagation()}>
            {nav.filter((n) => !PHONE_TABS.includes(n.id)).map(({ id, label, icon: Icon }) => (
              <a key={id} href={`#${id}`} className={page === id ? 'active' : ''} aria-current={page === id ? 'page' : undefined} onClick={() => setMoreOpen(false)}>
                <Icon size={18} strokeWidth={1.5} /> {label}{id === 'team' && admin.waiting > 0 && <b className="nav-badge">{admin.waiting}</b>}
              </a>
            ))}
            <hr />
            <button type="button" onClick={() => { setMoreOpen(false); setTouring(true) }}><Compass size={18} strokeWidth={1.5} /> Take a tour <small>{admin.is ? 'Admin' : 'Recruiter'}</small></button>
            <button type="button" onClick={(e) => reveal({ mode: nextMode }, e)}><ModeIcon size={18} strokeWidth={1.5} /> Theme: {prefs.mode}</button>
            <button type="button" onClick={() => { setMoreOpen(false); signOut() }}><LogOut size={18} strokeWidth={1.5} /> Sign out <small>{session.user.email}</small></button>
          </nav>
        </div>
      )}
      <main className="content">
        <ErrorBoundary key={`${page}/${param}`}><Page admin={admin.is} param={param} /></ErrorBoundary>
      </main>
      <Tour role={admin.is ? 'admin' : 'recruiter'} open={touring} onClose={() => setTouring(false)} />
    </div>
  )
}
