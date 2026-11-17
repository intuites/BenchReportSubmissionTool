import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { chromium, floatStyle, useFloating, useGlass } from '../lib/glass'
import { iso, today } from '../lib/period'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const MONTHS = Array.from({ length: 12 }, (_, m) => new Date(2026, m, 1).toLocaleDateString('en-US', { month: 'long' }))
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d) }
// the same day n months on, or that month's last day when it is shorter
const addMonths = (s, n) => { const d = parse(s); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return iso(d) }
const fullDate = (s) => parse(s).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

// React tracks an input's value, so a picked date goes in through the native setter plus an input event:
// the page's onChange then runs exactly as if the date had been typed
function setNative(input, v) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, v)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

// A real <input type="date"> (typing in its parts, required, min/max, form validation and page.fill all
// keep working) whose calendar is ours: a glass popover opened from the button at its end, a click on the
// field, or Alt+ArrowDown. On a phone the button opens the phone's own picker. The glass calendar needs
// Chromium (the only engine that lets us hide its own picker); other browsers keep their native one.
// range: { from, to } tints the days between, for a From/To pair.
export default function DateField({ value, onChange, min, max, required, range, className = '', ...props }) {
  const [open, setOpen] = useState(null) // null, or { grid: true } when focus should move into the calendar
  const box = useRef(null)
  const input = useRef(null)
  const opener = useRef(null)
  // the field's name, for the button and the calendar: aria-label, or the <label> around it (known after mount)
  const [name, setName] = useState(props['aria-label'])
  useEffect(() => { setName(props['aria-label'] || input.current?.labels?.[0]?.textContent?.replace('*', '').trim()) }, [props['aria-label']])

  const show = (grid, from) => { opener.current = from; setOpen({ grid }) }
  const close = (refocus) => { setOpen(null); if (refocus) (opener.current || input.current)?.focus() }
  const pick = (v) => { setNative(input.current, v); close(true) }

  function onInputKey(e) {
    if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); return show(true, input.current) }
    if (open && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false) }
    else if (open && e.key === 'Tab') close(false)
  }

  if (!chromium) return <input type="date" ref={input} className={className} value={value} onChange={onChange} min={min} max={max} required={required} {...props} />
  return (
    <span className="date-field" ref={box}>
      <input
        type="date"
        ref={input}
        className={className}
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        required={required}
        {...props}
        onMouseDown={(e) => { if (e.button === 0 && !open && e.nativeEvent.sourceCapabilities?.firesTouchEvents !== true) show(false, input.current) }}
        onKeyDown={onInputKey}
      />
      <button
        type="button"
        className="date-btn"
        aria-label={`Open calendar${name ? `: ${name}` : ''}`}
        aria-haspopup="dialog"
        aria-expanded={!!open}
        onKeyDown={(e) => { if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); show(true, e.currentTarget) } }}
        onClick={(e) => {
          if (e.nativeEvent.pointerType === 'touch') return input.current.showPicker?.()
          open ? close(false) : show(true, e.currentTarget)
        }}
      >
        <CalendarDays size={16} strokeWidth={1.75} aria-hidden />
      </button>
      {open && <Calendar anchor={box} value={value} min={min} max={max} required={required} range={range} req={open} onPick={pick} onClose={close} label={name || 'Date'} />}
    </span>
  )
}

function Calendar({ anchor, value, min, max, required, range, req, onPick, onClose, label }) {
  const now = today()
  const [cursor, setCursor] = useState(value || now) // the day the keyboard is on
  const [mode, setMode] = useState('days') // days → months → years
  const dir = useRef('') // which way the month moved, for its slide
  const panel = useRef(null)
  const focusNext = useRef(false) // after the next render, put focus on the cursor (keyboard moves, opening)
  const titleId = useId()
  const pos = useFloating(true, () => onClose(false), anchor, panel, { align: 'start', gap: 6 })
  useGlass(panel, !!pos)

  const [y, m] = cursor.split('-').map(Number)
  const view = `${y}-${m}`
  const months = (s) => +s.slice(0, 4) * 12 + +s.slice(5, 7)
  const setDay = (s) => { if (months(s) !== months(cursor)) dir.current = months(s) > months(cursor) ? 'next' : 'prev'; setCursor(s) }

  // typing a date in the field moves the calendar to it
  useEffect(() => { if (value) setDay(value) }, [value])
  // each open request that asks for the grid (opening by keyboard, or Alt+ArrowDown once open) moves focus in
  useEffect(() => { if (req.grid) focusNext.current = true }, [req])
  useEffect(() => {
    if (!pos || !focusNext.current) return
    focusNext.current = false
    const el = panel.current?.querySelector(mode === 'days' ? `[data-day="${cursor}"]` : '.cal-pick [aria-current="true"]') || panel.current?.querySelector('.cal-pick button:not(:disabled)')
    el?.focus({ preventScroll: true })
    if (mode === 'years') el?.scrollIntoView({ block: 'center' })
  }, [cursor, mode, !!pos, req])

  const off = (s) => (min && s < min) || (max && s > max)
  const go = (s) => { focusNext.current = true; setDay(s) }
  const monthStep = (n) => setDay(addMonths(cursor, n))

  function onGridKey(e) {
    const dow = (parse(cursor).getDay() + 6) % 7
    const k = e.key
    const to = {
      ArrowLeft: () => addDays(cursor, -1), ArrowRight: () => addDays(cursor, 1),
      ArrowUp: () => addDays(cursor, -7), ArrowDown: () => addDays(cursor, 7),
      Home: () => addDays(cursor, -dow), End: () => addDays(cursor, 6 - dow),
      PageUp: () => addMonths(cursor, e.shiftKey ? -12 : -1), PageDown: () => addMonths(cursor, e.shiftKey ? 12 : 1),
    }[k]
    if (to) { e.preventDefault(); go(to()) }
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); if (!off(cursor)) onPick(cursor) }
  }
  // months and years: arrows walk the buttons of the grid
  function onPickKey(e, cols) {
    const items = [...e.currentTarget.querySelectorAll('button:not(:disabled)')]
    const i = items.indexOf(document.activeElement)
    const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[e.key]
    if (d && i >= 0) { e.preventDefault(); items[Math.min(items.length - 1, Math.max(0, i + d))].focus() }
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(true) }
    else if (e.key === 'Tab') {
      // Tab walks the calendar; past either end it closes and goes back to the field
      e.stopPropagation()
      const items = [...panel.current.querySelectorAll('button:not(:disabled):not([tabindex="-1"])')]
      if (e.shiftKey ? document.activeElement === items[0] : document.activeElement === items[items.length - 1]) { e.preventDefault(); onClose(true) }
    }
  }

  // six weeks from the Monday on or before the 1st
  const first = new Date(y, m - 1, 1)
  const start = iso(new Date(y, m - 1, 1 - ((first.getDay() + 6) % 7)))
  const weeks = Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)))
  const inRange = (s) => range?.from && range?.to && range.from <= range.to && s >= range.from && s <= range.to
  const thisYear = +now.slice(0, 4)
  // the shown year is always in the list (a typed 1950, say), unless min or max rules it out
  const lo = min ? +min.slice(0, 4) : Math.min(thisYear - 60, y)
  const hi = max ? +max.slice(0, 4) : Math.max(thisYear + 10, y)
  const monthOff = (mm) => (max && `${y}-${String(mm + 1).padStart(2, '0')}-01` > max) || (min && iso(new Date(y, mm + 1, 0)) < min)

  return createPortal(
    <div ref={panel} className={`cal glass ${pos?.up ? 'up' : ''}`} role="dialog" aria-label={`Choose ${label.toLowerCase()}`} style={floatStyle(pos)} onKeyDown={onKey}>
      <header className="cal-head">
        <button type="button" className="cal-title" id={titleId} aria-live="polite" onClick={() => { focusNext.current = true; setMode(mode === 'days' ? 'months' : mode === 'months' ? 'years' : 'days') }} aria-label={`${mode === 'days' ? `${MONTHS[m - 1]} ${y}` : y}. ${mode === 'years' ? 'Back to days' : mode === 'days' ? 'Choose month' : 'Choose year'}`}>
          {mode === 'days' ? <><b>{MONTHS[m - 1]}</b> {y}</> : <b>{y}</b>}
        </button>
        {mode !== 'years' && (
          <span className="cal-steps">
            <button type="button" className="icon-btn" aria-label={mode === 'days' ? 'Previous month' : 'Previous year'} onClick={() => monthStep(mode === 'days' ? -1 : -12)}><ChevronLeft size={18} /></button>
            <button type="button" className="icon-btn" aria-label={mode === 'days' ? 'Next month' : 'Next year'} onClick={() => monthStep(mode === 'days' ? 1 : 12)}><ChevronRight size={18} /></button>
          </span>
        )}
      </header>

      {mode === 'days' && (
        <table className="cal-grid" role="grid" aria-label={`${MONTHS[m - 1]} ${y}`} onKeyDown={onGridKey}>
          <thead>
            <tr>{DAYS.map((d) => <th key={d} scope="col" abbr={d}>{d.slice(0, 2)}</th>)}</tr>
          </thead>
          <tbody key={view} className={dir.current ? `cal-slide-${dir.current}` : ''}>
            {weeks.map((week) => (
              <tr key={week[0]}>
                {week.map((s) => {
                  const r = inRange(s)
                  const cls = [
                    +s.slice(5, 7) !== m && 'out', s === now && 'today', s === value && 'selected', off(s) && 'disabled',
                    r && 'in-range', r && s === range.from && 'range-start', r && s === range.to && 'range-end',
                  ].filter(Boolean).join(' ')
                  return (
                    <td key={s} role="gridcell" aria-selected={s === value}>
                      <button
                        type="button"
                        className={`cal-day ${cls}`}
                        data-day={s}
                        tabIndex={s === cursor ? 0 : -1}
                        aria-label={fullDate(s)}
                        aria-current={s === now ? 'date' : undefined}
                        aria-disabled={off(s) || undefined}
                        onClick={() => { if (!off(s)) onPick(s) }}
                      >
                        {+s.slice(8)}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {mode === 'months' && (
        <div className="cal-pick cal-months" onKeyDown={(e) => onPickKey(e, 3)}>
          {MONTHS.map((name, mm) => (
            <button key={name} type="button" disabled={monthOff(mm)} aria-current={mm === m - 1} onClick={() => { focusNext.current = true; setDay(addMonths(cursor, mm - (m - 1))); setMode('days') }}>{name.slice(0, 3)}</button>
          ))}
        </div>
      )}

      {mode === 'years' && (
        <div className="cal-pick cal-years" onKeyDown={(e) => onPickKey(e, 4)}>
          {Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).map((yy) => (
            <button key={yy} type="button" aria-current={yy === y} onClick={() => { focusNext.current = true; setDay(addMonths(cursor, (yy - y) * 12)); setMode('months') }}>{yy}</button>
          ))}
        </div>
      )}

      <footer className="cal-foot">
        <button type="button" className="btn ghost small" disabled={!!off(now)} onClick={() => onPick(now)}>Today</button>
        {!required && <button type="button" className="btn ghost small" disabled={!value} onClick={() => onPick('')}>Clear</button>}
      </footer>
    </div>,
    document.body,
  )
}
