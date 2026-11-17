import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'
import { floatStyle, useFloating, useGlass } from '../lib/glass'
import { Liquid, useActiveRect } from './Liquid'

const OPEN_KEYS = [' ', 'Enter', 'ArrowDown', 'ArrowUp', 'F4'] // plain or with Alt, as the system popup opens

// A real <select> (same id, name, required, value and onChange, so form validation, phone pickers,
// screen readers and selectOption keep working) that opens a glass list instead of the system popup
// when used with a mouse or keyboard. A touch opens the phone's own picker.
// The <select> itself is the field you see (appearance: none in styles.css).
export default function Select({ children, className = '', ...props }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const box = useRef(null)
  const sel = useRef(null)
  const list = useRef(null)
  const pointer = useRef('mouse')
  const typed = useRef({ text: '', at: 0 })
  const uid = useId()
  const scroll = useRef(null)
  const pos = useFloating(open, () => setOpen(false), box, list, { align: 'start', cap: 320 })
  useGlass(list, open && !!pos) // only once placed at its real width, so no throwaway lens map

  const options = open && sel.current ? [...sel.current.options] : []
  const lens = useActiveRect(scroll, open ? active : -1)
  const optId = (i) => `${uid}-o${i}`

  useEffect(() => { if (open && pos) list.current?.focus({ preventScroll: true }) }, [open, !!pos])
  useEffect(() => { if (open) list.current?.querySelector(`[id="${optId(active)}"]`)?.scrollIntoView({ block: 'nearest' }) }, [active, open, !!pos])

  function show() {
    setActive(Math.max(0, sel.current.selectedIndex))
    setOpen(true)
  }
  function close() { setOpen(false); sel.current?.focus() }
  function choose(i) {
    const o = options[i]
    if (!o || o.disabled) return
    if (sel.current.value !== o.value) {
      sel.current.value = o.value
      sel.current.dispatchEvent(new Event('change', { bubbles: true }))
    }
    close()
  }
  // the next enabled option from i in direction d, staying put at the ends
  const step = (i, d) => { for (let j = i + d; j >= 0 && j < options.length; j += d) if (!options[j].disabled) return j; return i }

  function onSelectMouseDown(e) {
    if (pointer.current === 'touch' || e.button !== 0) return
    e.preventDefault() // no system popup
    sel.current.focus()
    open ? setOpen(false) : show()
  }
  function onSelectKey(e) {
    if (open || !matchMedia('(any-pointer: fine)').matches) return
    if (OPEN_KEYS.includes(e.key) && !e.ctrlKey && !e.metaKey) { e.preventDefault(); show() }
  }
  function onListKey(e) {
    const k = e.key
    let next = null
    if (k === 'ArrowDown') next = step(active, 1)
    else if (k === 'ArrowUp') next = step(active, -1)
    else if (k === 'Home') next = step(-1, 1)
    else if (k === 'End') next = step(options.length, -1)
    else if (k === 'PageDown') next = Math.min(options.length - 1, active + 8)
    else if (k === 'PageUp') next = Math.max(0, active - 8)
    else if (k === 'Enter' || (k === ' ' && Date.now() - typed.current.at >= 500)) { e.preventDefault(); return choose(active) }
    else if (k === 'Escape' || k === 'Tab') { e.preventDefault(); e.stopPropagation(); return close() }
    else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // type-ahead: letters typed within half a second build one search, from the next option on
      const now = Date.now()
      const text = (now - typed.current.at < 500 ? typed.current.text : '') + k.toLowerCase()
      typed.current = { text, at: now }
      const from = text.length === 1 ? active + 1 : active
      const hit = [...options.slice(from), ...options.slice(0, from)].find((o) => !o.disabled && o.text.toLowerCase().startsWith(text))
      if (hit) next = hit.index
    } else return
    e.preventDefault()
    e.stopPropagation()
    if (next != null) setActive(next)
  }

  const empty = !props.value
  return (
    <div className="select" ref={box}>
      <select
        {...props}
        ref={sel}
        className={`${className} ${empty ? 'is-empty' : ''}`}
        aria-expanded={open}
        aria-controls={open ? `${uid}-list` : undefined}
        onPointerDown={(e) => { pointer.current = e.pointerType }}
        onMouseDown={onSelectMouseDown}
        onKeyDown={onSelectKey}
      >
        {children}
      </select>
      {open && createPortal(
        <div
          ref={list}
          id={`${uid}-list`}
          className={`select-list glass ${pos?.up ? 'up' : ''}`}
          role="listbox"
          tabIndex={-1}
          aria-label={sel.current?.labels?.[0]?.textContent?.replace('*', '').trim() || props['aria-label']}
          aria-activedescendant={optId(active)}
          onKeyDown={onListKey}
          style={floatStyle(pos, { minWidth: pos?.width })}
        >
          <div className="select-scroll" role="presentation" ref={scroll}>
          <Liquid rect={lens} tone="pick" />
          {options.map((o, i) => (
            <div
              key={`${i}-${o.value}`}
              id={optId(i)}
              role="option"
              aria-selected={o.selected}
              aria-disabled={o.disabled || undefined}
              data-active={i === active}
              style={{ '--i': Math.min(i, 10) }}
              className={`select-option ${i === active ? 'active' : ''} ${o.value === '' ? 'placeholder' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(i)}
            >
              <span>{o.text}</span>
              {o.selected && o.value !== '' && <Check size={16} strokeWidth={2} aria-hidden />}
            </div>
          ))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
