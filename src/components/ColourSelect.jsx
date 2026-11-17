import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { floatStyle, useFloating, useGlass } from '../lib/glass'

const COLS = 4

// A colour picker made of named, visible colours: one button shows the current colour,
// and opens a panel of colour tiles grouped by family, with search. Never a colour code.
// Keyboard: arrows move across the grid, Enter picks, Escape closes.
export default function ColourSelect({ groups, value, onChange, label = 'Accent colour' }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const box = useRef(null)
  const search = useRef(null)
  const grid = useRef(null)
  const pop = useRef(null)
  // a floating glass panel (portal) under the button, or above it when the screen has no room below
  const pos = useFloating(open, () => setOpen(false), box, pop, { align: 'start', gap: 8, cap: 440 })
  useGlass(pop, open && !!pos)

  const all = useMemo(() => groups.flatMap(([family, items]) => items.map(([name, c]) => ({ name, c, family }))), [groups])
  const current = all.find((o) => o.c.toLowerCase() === value.toLowerCase()) ?? { name: 'Your earlier colour', c: value, family: 'Custom' }
  const shown = all.filter((o) => !q || `${o.name} ${o.family}`.toLowerCase().includes(q.trim().toLowerCase()))

  useEffect(() => {
    if (!open) return
    setQ('')
    setActive(Math.max(0, all.findIndex((o) => o.c === current.c)))
  }, [open])
  // focus once placed: a panel still hidden off screen cannot take focus
  useEffect(() => { if (open && pos) search.current?.focus({ preventScroll: true }) }, [open, !!pos])
  useEffect(() => { setActive(0) }, [q])
  useEffect(() => { if (open) grid.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' }) }, [active, open])

  const close = () => { setOpen(false); box.current?.querySelector('.colour-trigger')?.focus() }
  const pick = (o) => { onChange(o.c); close() }
  function onKey(e) {
    if (!open) return
    // with text in the search box, Left and Right move its caret
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.target === search.current && q) return
    const move = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLS, ArrowUp: -COLS }[e.key]
    if (move) { e.preventDefault(); setActive((a) => Math.min(shown.length - 1, Math.max(0, a + move))) }
    else if (e.key === 'Enter') { e.preventDefault(); if (shown[active]) pick(shown[active]) }
    else if (e.key === 'Escape') { e.preventDefault(); close() }
    // the panel sits at the end of the page: Tab closes it and carries on from the button, like MenuButton
    else if (e.key === 'Tab') close()
  }

  let i = -1
  return (
    <div className="colour-select" ref={box} onKeyDown={onKey}>
      <button type="button" className="colour-trigger" aria-haspopup="dialog" aria-expanded={open} aria-label={`${label}: ${current.name}. Change colour`} onClick={() => setOpen((o) => !o)}>
        <span className="colour-chip" style={{ '--c': current.c }} aria-hidden />
        <span className="colour-text"><b>{current.name}</b><small>{current.family}</small></span>
        <span className="colour-change">Change <ChevronDown size={16} strokeWidth={1.5} aria-hidden /></span>
      </button>
      {open && createPortal(
        <div ref={pop} className={`colour-pop glass ${pos?.up ? 'up' : ''}`} role="dialog" aria-label={`Choose ${label.toLowerCase()}`} style={floatStyle(pos, { width: Math.min(Math.max(pos?.width ?? 0, 380), 560, document.documentElement.clientWidth - 32) })}>
          <label className="colour-search">
            <Search size={16} strokeWidth={1.5} aria-hidden />
            <input ref={search} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search colours" aria-label="Search colours" />
            <span className="colour-count" aria-live="polite">{shown.length}<span className="sr-only"> colours</span></span>
            {q && <button type="button" className="colour-clear" aria-label="Clear search" onClick={() => { setQ(''); search.current?.focus() }}><X size={14} strokeWidth={2} /></button>}
          </label>
          <div className="colour-groups" ref={grid} role="listbox" aria-label={label}>
            {groups.map(([family]) => {
              const items = shown.filter((o) => o.family === family)
              if (!items.length) return null
              return (
                <section key={family} className="colour-group">
                  <h3>{family}</h3>
                  <div className="colour-grid">
                    {items.map((o) => {
                      i += 1
                      const n = i
                      const selected = o.c === current.c
                      return (
                        <button
                          key={o.c}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          data-i={n}
                          className={`colour-tile ${n === active ? 'active' : ''}`}
                          onMouseEnter={() => setActive(n)}
                          onClick={() => pick(o)}
                        >
                          <span className="colour-swatch" style={{ '--c': o.c }} aria-hidden>{selected && <Check size={16} strokeWidth={2.5} />}</span>
                          <span className="colour-name">{o.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )
            })}
            {!shown.length && <p className="colour-none">No colour called “{q}”</p>}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
