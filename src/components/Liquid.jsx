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
// The hover lenses in menus, lists and the calendar ('pick', 'bad') are a drop of water instead.
export function Liquid({ rect, tone = 'accent' }) {
  const prev = useRef(null)
  const dir = useRef({ y: 'down', x: 'right' })
  const p = prev.current
  if (rect && p) {
    if (rect.top !== p.top) dir.current = { ...dir.current, y: rect.top > p.top ? 'down' : 'up' }
    if (rect.left !== p.left) dir.current = { ...dir.current, x: rect.left > p.left ? 'right' : 'left' }
  }
  useEffect(() => { prev.current = rect })
  if (tone === 'pick' || tone === 'bad') return <Drop rect={rect} tone={tone} />
  if (!rect) return null
  return <span className={`lens lens--${tone}`} data-dir={dir.current.y === 'down' || dir.current.x === 'right' ? 'fwd' : 'back'} data-y={dir.current.y} data-x={dir.current.x} style={rect} aria-hidden />
}

// A drop of water that follows the pointer. Each edge is a spring, so a fast sweep never stops
// and starts again on every item (as CSS transitions do): the edge moving toward the pointer is
// stiff and gets there almost at once, the edge behind is soft and follows, so the drop stretches
// over everything it passed. Stretched, it thins across and rounds off into a pill, and glows a
// little with the flow; arriving, its soft edge overshoots and wobbles before it settles.
const LEAD = [900, 0.85] // stiffness, damping ratio
const TRAIL = [90, 0.74]
const EDGES = ['x1', 'x2', 'y1', 'y2']
const reducedNow = () => document.documentElement.dataset.motion === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches

function Drop({ rect, tone }) {
  const el = useRef(null)
  const state = useRef(null) // where each edge is now, and how fast it moves
  const raf = useRef(0)
  const radius = useRef(8)

  useLayoutEffect(() => {
    const node = el.current
    if (!node || !rect) return
    const box = node.offsetParent
    if (!box) return
    const t = { x1: rect.left, x2: box.clientWidth - rect.right, y1: rect.top, y2: box.clientHeight - rect.bottom }
    const cur = state.current
    // a new drop (just opened, or back after no item was under it) appears in place
    if (!cur || cur.node !== node || reducedNow()) {
      radius.current = parseFloat(getComputedStyle(node).borderTopLeftRadius) || 8
      state.current = { node, ...t, v: { x1: 0, x2: 0, y1: 0, y2: 0 } }
      draw(node, state.current, t, radius.current)
      return
    }
    // the edges on the side it is heading to lead; the others trail
    const dx = t.x1 + t.x2 - cur.x1 - cur.x2, dy = t.y1 + t.y2 - cur.y1 - cur.y2
    const lead = { x1: dx < 0, x2: dx > 0, y1: dy < 0, y2: dy > 0 }
    cancelAnimationFrame(raf.current)
    if (!node.hasAttribute('data-moving')) {
      node.setAttribute('data-moving', '')
      node.dispatchEvent(new CustomEvent('liquidmove', { bubbles: true })) // glass.js rests its lens meanwhile
    }
    let last = performance.now()
    const step = (now) => {
      const dt = Math.min(0.032, (now - last) / 1000)
      last = now
      let busy = false
      for (const k of EDGES) {
        const [stiff, ratio] = lead[k] ? LEAD : TRAIL
        const a = stiff * (t[k] - cur[k]) - 2 * Math.sqrt(stiff) * ratio * cur.v[k]
        cur.v[k] += a * dt
        cur[k] += cur.v[k] * dt
        if (Math.abs(t[k] - cur[k]) > 0.25 || Math.abs(cur.v[k]) > 4) busy = true
      }
      if (busy) {
        draw(node, cur, t, radius.current)
        raf.current = requestAnimationFrame(step)
      } else {
        Object.assign(cur, t, { v: { x1: 0, x2: 0, y1: 0, y2: 0 } })
        draw(node, cur, t, radius.current)
        node.removeAttribute('data-moving')
      }
    }
    raf.current = requestAnimationFrame(step)
  }, [rect?.top, rect?.left, rect?.right, rect?.bottom]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => cancelAnimationFrame(raf.current), [])
  if (!rect) return null
  return <span ref={el} className={`lens lens--${tone} drop`} aria-hidden />
}

// Writes the drop's shape: its box, thinned across the way it stretches (a drop keeps its volume),
// rounder the more it stretches, and a glow that grows with the flow
function draw(node, s, t, r0) {
  const w = Math.max(1, s.x2 - s.x1), h = Math.max(1, s.y2 - s.y1)
  const tw = Math.max(1, t.x2 - t.x1), th = Math.max(1, t.y2 - t.y1)
  const sx = w / tw, sy = h / th
  const pull = Math.min(1, Math.max(0, Math.max(sx, sy) - 1)) // 0 at rest, 1 when stretched to double
  // thin across the stretch, at most a fifth, about the drop's middle
  const thinH = sy < sx ? h * Math.min(0.2, (sx - 1) * 0.12) : 0
  const thinW = sx < sy ? w * Math.min(0.2, (sy - 1) * 0.12) : 0
  const W = w - thinW, H = h - thinH
  const st = node.style
  st.transform = `translate3d(${(s.x1 + thinW / 2).toFixed(2)}px, ${(s.y1 + thinH / 2).toFixed(2)}px, 0)`
  st.width = `${W.toFixed(2)}px`
  st.height = `${H.toFixed(2)}px`
  st.borderRadius = `${(r0 + (Math.min(W, H) / 2 - r0) * Math.min(1, pull * 1.6)).toFixed(2)}px`
  st.setProperty('--flow', pull.toFixed(3))
}
