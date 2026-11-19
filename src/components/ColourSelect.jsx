import { useMemo, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { accentTokens } from '../lib/color'

// Every accent at once, on the page itself: one row of round swatches per family, no panel to open and
// nothing to scroll. The line above names the colour under the pointer (or keyboard), else the chosen one.
// Keyboard: a radio group; arrows move and choose (Up and Down to the nearest swatch in the next line).
export default function ColourSelect({ groups, value, onChange, label = 'Accent colour' }) {
  const box = useRef(null)
  const [peek, setPeek] = useState(null)
  const all = useMemo(() => groups.flatMap(([family, items]) => items.map(([name, c]) => ({ name, c, family, on: accentTokens(c, false).on }))), [groups])
  const current = all.find((o) => o.c.toLowerCase() === value.toLowerCase())
  const shown = peek ?? current ?? { name: 'Your earlier colour', c: value, family: 'Custom' }

  function onKey(e) {
    const btns = [...box.current.querySelectorAll('.swatch')]
    const i = btns.indexOf(document.activeElement)
    if (i < 0) return
    let j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: btns.length - 1 }[e.key]
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const at = btns[i].getBoundingClientRect(), down = e.key === 'ArrowDown'
      const tops = btns.map((b) => b.getBoundingClientRect())
      const next = tops.filter((r) => (down ? r.top > at.top + 4 : r.top < at.top - 4))
      if (!next.length) return e.preventDefault()
      const line = down ? Math.min(...next.map((r) => r.top)) : Math.max(...next.map((r) => r.top))
      let best = -1
      tops.forEach((r, k) => { if (Math.abs(r.top - line) < 4 && (best < 0 || Math.abs(r.left - at.left) < Math.abs(tops[best].left - at.left))) best = k })
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
    <div className="palette" ref={box} onKeyDown={onKey} onPointerLeave={() => setPeek(null)} onBlur={(e) => { if (!box.current.contains(e.relatedTarget)) setPeek(null) }}>
      <p className="palette-now" aria-hidden>
        <i style={{ '--c': shown.c }} /><b>{shown.name}</b><small>{shown.family}</small>
      </p>
      <div role="radiogroup" aria-label={label} className="palette-groups">
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
  )
}
