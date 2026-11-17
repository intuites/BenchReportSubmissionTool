import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import { floatStyle, useFloating, useGlass } from '../lib/glass'
import { Liquid, useActiveRect } from './Liquid'

// One button that opens a short menu of actions (Export → PDF, Excel; Manage → Make admin, …).
// items: [{ id, label, note, icon: Icon, danger }]. Arrows move, Enter picks, Escape closes.
// The menu is drawn at the top of the page (a portal), so a card or a scrolling table can never clip it;
// it opens below its button, or above when there is no room. Key presses inside the portal still
// bubble to the wrapper through React, so only the wrapper handles keys (once, not twice).
export default function MenuButton({ label, icon: Icon, items, onPick, disabled, busy, primary, small, ariaLabel }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const box = useRef(null)
  const list = useRef(null)
  const pos = useFloating(open, () => setOpen(false), box, list)
  useGlass(list, open && !!pos)
  const lens = useActiveRect(list, open ? active : -1)

  useEffect(() => { if (open) setActive(0) }, [open])
  useEffect(() => { if (open && pos) list.current?.querySelectorAll('[role="menuitem"]')[active]?.focus({ preventScroll: true }) }, [active, open, !!pos])

  const close = () => { setOpen(false); box.current?.querySelector('.menu-trigger')?.focus() }
  function onKey(e) {
    if (!open) return
    if (e.key === 'Escape') { e.preventDefault(); close() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % items.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + items.length) % items.length) }
    else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); setActive(e.key === 'Home' ? 0 : items.length - 1) }
    else if (e.key === 'Tab') close()
  }

  return (
    <div className="menu-button" ref={box} onKeyDown={onKey}>
      <button type="button" className={`btn menu-trigger ${primary ? 'primary' : ''} ${small ? 'small' : ''}`} aria-label={ariaLabel} aria-haspopup="menu" aria-expanded={open} disabled={disabled} aria-busy={busy} onClick={() => setOpen((o) => !o)}>
        {Icon && <Icon size={16} />} {label} <ChevronDown size={16} className="menu-chevron" aria-hidden />
      </button>
      {open && createPortal(
        <div ref={list} className={`menu-list menu-list--floating glass ${pos?.up ? 'up' : ''}`} role="menu" aria-label={ariaLabel || label} style={floatStyle(pos)}>
          <Liquid rect={lens} tone={items[active]?.danger ? 'bad' : 'pick'} />
          {items.map(({ id, label: text, note, icon: ItemIcon, danger }, i) => (
            <button key={id} type="button" role="menuitem" className={danger ? 'danger-item' : undefined} tabIndex={i === active ? 0 : -1} data-active={i === active} style={{ '--i': i }} onMouseEnter={() => setActive(i)} onClick={() => { close(); onPick(id) }}>
              {ItemIcon && <ItemIcon size={18} strokeWidth={1.5} aria-hidden />}
              <span><b>{text}</b>{note && <small>{note}</small>}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
