import { useEffect, useLayoutEffect, useRef, useState } from 'react'

// Where the [data-active="true"] child sits inside a positioned container,
// as distances from each edge (so each edge can move on its own timing).
// Offsets are summed up the offsetParent chain (a table cell is one), so a cell in a calendar works,
// a scrolled list keeps the lens on its row, and an opening panel's scale animation does not skew it.
export function useActiveRect(ref, key) {
  const [rect, setRect] = useState(null)
  useLayoutEffect(() => {
    const box = ref.current
    if (!box) return
    const measure = () => {
      // the first one shown: on a phone a page under More is hidden and More carries the mark
      const el = [...box.querySelectorAll('[data-active="true"]')].find((n) => n.offsetParent !== null)
      if (!el) return setRect(null)
      let top = 0, left = 0, n = el
      while (n && n !== box) { top += n.offsetTop; left += n.offsetLeft; n = n.offsetParent }
      setRect({ top, left, right: box.clientWidth - left - el.offsetWidth, bottom: box.clientHeight - top - el.offsetHeight })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    box.querySelectorAll('[data-active]').forEach((el) => ro.observe(el))
    document.fonts?.ready.then(measure)
    return () => ro.disconnect()
  }, [ref, key])
  return rect
}

// The selection lens: one glass pill. On each axis its leading edge reaches the new item
// first and its trailing edge follows, so it stretches toward where you went and then
// draws in, like liquid. (Timing per edge is in styles.css.)
export function Liquid({ rect, tone = 'accent' }) {
  const prev = useRef(null)
  const dir = useRef({ y: 'down', x: 'right' })
  const p = prev.current
  if (rect && p) {
    if (rect.top !== p.top) dir.current = { ...dir.current, y: rect.top > p.top ? 'down' : 'up' }
    if (rect.left !== p.left) dir.current = { ...dir.current, x: rect.left > p.left ? 'right' : 'left' }
  }
  useEffect(() => { prev.current = rect })
  if (!rect) return null
  return <span className={`lens lens--${tone}`} data-dir={dir.current.y === 'down' || dir.current.x === 'right' ? 'fwd' : 'back'} data-y={dir.current.y} data-x={dir.current.x} style={rect} aria-hidden />
}
