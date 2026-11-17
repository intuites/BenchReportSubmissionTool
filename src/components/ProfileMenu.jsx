import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronUp, Compass, LogOut, Palette } from 'lucide-react'
import { floatStyle, useFloating, useGlass } from '../lib/glass'

// The signed-in person at the foot of the sidebar. One role is shown, never two:
// an admin already has everything a recruiter has, so admins read "Admin".
export default function ProfileMenu({ email, name, role, onTour, onTheme, themeLabel, ThemeIcon, onSignOut }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const box = useRef(null)
  const menu = useRef(null)
  const initial = (name || email || '?').trim()[0].toUpperCase()
  // drawn in a portal so its glass bends the page beside the sidebar, not just the sidebar
  const pos = useFloating(open, () => setOpen(false), box, menu, { up: true, align: 'start', gap: 8 })
  useGlass(menu, open && !!pos)

  useEffect(() => { if (open) setActive(0) }, [open])
  useEffect(() => { if (open && pos) menu.current?.querySelectorAll('[role="menuitem"]')[active]?.focus({ preventScroll: true }) }, [active, open, !!pos])

  const close = () => { setOpen(false); box.current?.querySelector('.profile-trigger')?.focus() }
  const run = (fn) => (e) => { setOpen(false); fn(e) }
  function onKey(e) {
    if (!open) return
    const n = menu.current.querySelectorAll('[role="menuitem"]').length
    if (e.key === 'Escape') { e.preventDefault(); close() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % n) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + n) % n) }
    else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); setActive(e.key === 'Home' ? 0 : n - 1) }
    else if (e.key === 'Tab') close()
  }

  return (
    <div className="profile" ref={box} onKeyDown={onKey}>
      {open && createPortal(
        <div ref={menu} className="profile-menu glass up" role="menu" aria-label="Your account" style={floatStyle(pos, { width: Math.max(260, pos?.width ?? 0) })}>
          <div className="profile-head">
            <span className="avatar big" aria-hidden>{initial}</span>
            <span className="profile-id"><b title={email}>{name || email}</b>{name && <small title={email}>{email}</small>}</span>
            <span className={`role-badge role-badge--${role}`}>{role === 'admin' ? 'Admin' : 'Recruiter'}</span>
          </div>
          <button type="button" role="menuitem" data-tour="take-tour" onClick={run(onTour)}><Compass size={18} strokeWidth={1.5} /> Take a tour<small>{role === 'admin' ? 'Admin tour' : 'Recruiter tour'}</small></button>
          <a role="menuitem" href="#appearance" onClick={() => setOpen(false)}><Palette size={18} strokeWidth={1.5} /> Appearance</a>
          <button type="button" role="menuitem" onClick={run(onTheme)}><ThemeIcon size={18} strokeWidth={1.5} /> Theme<small>{themeLabel}</small></button>
          <hr />
          <button type="button" role="menuitem" className="danger-item" onClick={run(onSignOut)}><LogOut size={18} strokeWidth={1.5} /> Sign out</button>
        </div>,
        document.body,
      )}
      <button type="button" className="profile-trigger" data-tour="profile" aria-haspopup="menu" aria-expanded={open} aria-label={`Account: ${email}, ${role === 'admin' ? 'admin' : 'recruiter'}. Open menu`} onClick={() => setOpen((o) => !o)}>
        <span className="avatar" aria-hidden>{initial}</span>
        <span className="profile-id"><b>{name || email}</b><small>{role === 'admin' ? 'Admin' : 'Recruiter'}</small></span>
        <ChevronUp size={16} strokeWidth={1.5} className="profile-chevron" aria-hidden />
      </button>
    </div>
  )
}
