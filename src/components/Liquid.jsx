import { useEffect, useLayoutEffect, useRef, useState } from 'react'

// Where the [data-active="true"] child sits inside a positioned container,
// as distances from each edge (so each edge can move on its own timing).
export function useActiveRect(ref, key) {
  const [rect, setRect] = useState(null)
  useLayoutEffect(() => {
    const box = ref.current
    if (!box) return
    const measure = () => {
      // the first one shown: on a phone a page under More is hidden and More carries the mark
      const el = [...box.querySelectorAll('[data-active="true"]')].find((n) => n.offsetParent !== null)
      setRect(el ? {
        top: el.offsetTop,
        left: el.offsetLeft,
        right: box.clientWidth - el.offsetLeft - el.offsetWidth,
        bottom: box.clientHeight - el.offsetTop - el.offsetHeight,
      } : null)
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

// The selection lens: one glass pill. Its leading edge reaches the new item
// first and its trailing edge follows, so it stretches toward where you
// clicked and then draws in, like liquid. (Timing per edge is in styles.css.)
export function Liquid({ rect, tone = 'accent' }) {
  const prev = useRef(null)
  const dir = useRef('fwd')
  if (rect && prev.current && (rect.top !== prev.current.top || rect.left !== prev.current.left)) {
    dir.current = rect.top > prev.current.top || rect.left > prev.current.left ? 'fwd' : 'back'
  }
  useEffect(() => { prev.current = rect })
  if (!rect) return null
  return <span className={`lens lens--${tone}`} data-dir={dir.current} style={rect} aria-hidden />
}
