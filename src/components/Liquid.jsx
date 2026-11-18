import { useLayoutEffect, useState } from 'react'

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

// The selection highlight: it slides quickly and evenly to the item you point at
export function Liquid({ rect, tone = 'accent' }) {
  if (!rect) return null
  return <span className={`lens lens--${tone}`} style={rect} aria-hidden />
}

// Only the app's own Reduce motion switch (Appearance) stills the burst and the pet; the computer's
// animation setting alone does not
const reducedNow = () => document.documentElement.dataset.motion === 'reduced'

// Picking a date bursts it: a flash, a ring and a spray of droplets over the day, drawn above the
// page, so the calendar closes at once and the burst plays on over where the day was.
// A big burst throws more droplets, further.
export function burst(el, opts) {
  if (!el || reducedNow()) return
  const r = el.getBoundingClientRect()
  burstAt({ left: r.left, top: r.top, width: r.width, height: r.height }, getComputedStyle(el).borderRadius, opts)
}

// The same burst at any spot on the screen
export function burstAt(r, radius = '50%', { beads: count = 10, reach = 1 } = {}) {
  if (reducedNow()) return
  const b = document.createElement('div')
  b.className = 'drop-burst'
  b.setAttribute('aria-hidden', 'true')
  Object.assign(b.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, borderRadius: radius })
  const beads = Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 + (i % 2) * 0.25
    const d = (Math.max(r.width, r.height) / 2 + 10 + (i % 3) * 8) * reach
    return `<i class="bead" style="--dx:${(Math.cos(a) * d).toFixed(1)}px;--dy:${(Math.sin(a) * d).toFixed(1)}px;--s:${(0.7 + (i % 3) * 0.2).toFixed(2)}"></i>`
  }).join('')
  b.innerHTML = `<i class="flash"></i><i class="ring"></i>${beads}`
  document.body.appendChild(b)
  setTimeout(() => b.remove(), 760)
}
