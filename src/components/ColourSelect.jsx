import { useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { accentTokens } from '../lib/color'

// The accent picker: one button shows the colour; it expands the full palette in place, a row of round
// swatches per family (no floating panel, nothing scrolls inside it), and collapses it again. The button
// names the colour under the pointer or keyboard while the palette is open, else the chosen one.
// Keyboard: the swatches are a radio group; arrows move and choose (Up and Down to the nearest swatch in
// the next line), Escape collapses back to the button.
export default function ColourSelect({ groups, value, onChange, label = 'Accent colour' }) {
  const box = useRef(null)
  const id = useId()
  const [open, setOpen] = useState(false)
  const [peek, setPeek] = useState(null)
  const all = useMemo(() => groups.flatMap(([family, items]) => items.map(([name, c]) => ({ name, c, family, on: accentTokens(c, false).on }))), [groups])
  const current = all.find((o) => o.c.toLowerCase() === value.toLowerCase())
  const shown = (open && peek) || current || { name: 'Your earlier colour', c: value, family: 'Custom' }

  function onKey(e) {
    if (e.key === 'Escape' && open) { e.preventDefault(); setOpen(false); setPeek(null); box.current.querySelector('.palette-toggle').focus(); return }
    const btns = [...box.current.querySelectorAll('.swatch')]
    const i = btns.indexOf(document.activeElement)
    if (i < 0) return
    let j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: btns.length - 1 }[e.key]
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const at = btns[i].getBoundingClientRect(), down = e.key === 'ArrowDown'
      const rects = btns.map((b) => b.getBoundingClientRect())
      const next = rects.filter((r) => (down ? r.top > at.top + 4 : r.top < at.top - 4))
      if (!next.length) return e.preventDefault()
      const line = down ? Math.min(...next.map((r) => r.top)) : Math.max(...next.map((r) => r.top))
      let best = -1
      rects.forEach((r, k) => { if (Math.abs(r.top - line) < 4 && (best < 0 || Math.abs(r.left - at.left) < Math.abs(rects[best].left - at.left))) best = k })
      j = best
    }
    if (j === undefined) return
    e.preventDefault()
    const b = btns[Math.max(0, Math.min(btns.length - 1, j))]
    b.focus()
    b.click()
  }

  let first = !current
  return (
    <div className="palette" ref={box} onKeyDown={onKey} onBlur={(e) => { if (!box.current.contains(e.relatedTarget)) setPeek(null) }}>
      <button type="button" className="palette-toggle" aria-expanded={open} aria-controls={id} onClick={() => { setOpen((o) => !o); setPeek(null) }}>
        <span className="palette-chip" style={{ '--c': shown.c }} aria-hidden />
        <span className="palette-name"><b>{shown.name}</b><small>{shown.family}</small></span>
        <span className="palette-more">{open ? 'Collapse' : `All ${all.length} colours`} <ChevronDown size={16} strokeWidth={1.5} aria-hidden /></span>
      </button>
      <div className={`palette-body ${open ? 'open' : ''}`} id={id}>
        <div className="palette-inner">
          <div role="radiogroup" aria-label={label} className="palette-groups" onPointerLeave={() => setPeek(null)}>
            {groups.map(([family]) => (
              <div key={family} className="palette-row">
                <span className="palette-family">{family}</span>
                <div className="palette-swatches">
                  {all.filter((o) => o.family === family).map((o) => {
                    const on = o === current
                    const tab = on || first
                    first = false
                    return (
                      <button
                        key={o.c}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        aria-label={o.name}
                        title={o.name}
                        tabIndex={tab ? 0 : -1}
                        className="swatch"
                        style={{ '--c': o.c, color: o.on }}
                        onPointerEnter={() => setPeek(o)}
                        onFocus={() => setPeek(o)}
                        onClick={() => onChange(o.c)}
                      >
                        {on && <Check size={16} strokeWidth={2.5} aria-hidden />}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
