import { useLayoutEffect, useState } from 'react'

// Glass with real refraction. Every floating panel (menus, dropdown lists, the calendar) bends the page
// behind it at its rounded edge, like the curved rim of a glass slab: an SVG filter shifts each backdrop
// pixel inward along the edge normal, strongest at the very edge and easing to nothing BEZEL px in.
// backdrop-filter: url() works only in Chromium, so <html> gets .glass-refract there; other browsers get
// the same panel as frosted glass (blur + saturate) from styles.css.
export const chromium = typeof navigator !== 'undefined' && !!navigator.userAgentData?.brands?.some((b) => /Chromium/.test(b.brand))
if (chromium) document.documentElement.classList.add('glass-refract')

const BEZEL = 40 // px of rim that bends
const DEPTH = 18 // px the view is pulled in at the very edge (under BEZEL / 2, so the rim magnifies without folding)
const NS = 'http://www.w3.org/2000/svg'
const cache = new Map() // `${w}x${h}x${r}` -> filter id, oldest first
const inUse = new Map() // filter id -> how many open panels point at it (those are never evicted)
let defs = null

const RIM = 10, FADE = 24 // px from the edge: the crisp bent rim, then its fade into the frosted core

// R and G carry the x and y shift (128 = none) for a w×h rounded rectangle of radius r;
// B is the rim weight (255 = the crisp bent backdrop, 0 = the frosted core)
export function lensData(w, h, r) {
  const d = new Uint8ClampedArray(w * h * 4)
  const hw = w / 2, hh = h / 2
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5 - hw, py = y + 0.5 - hh
      const qx = Math.abs(px) - (hw - r), qy = Math.abs(py) - (hh - r)
      // inward distance from the edge and the outward normal there (signed distance of a rounded box)
      let t, nx = 0, ny = 0
      if (qx > 0 && qy > 0) { const l = Math.hypot(qx, qy); t = r - l; nx = (qx / l) * Math.sign(px); ny = (qy / l) * Math.sign(py) }
      else if (qx > qy) { t = r - qx; nx = Math.sign(px) }
      else { t = r - qy; ny = Math.sign(py) }
      const m = t >= 0 && t < BEZEL ? (1 - t / BEZEL) ** 2 : 0
      const i = (y * w + x) * 4
      d[i] = 128 - nx * m * 127
      d[i + 1] = 128 - ny * m * 127
      const k = Math.min(1, Math.max(0, (FADE - t) / (FADE - RIM)))
      d[i + 2] = 255 * k * k * (3 - 2 * k)
      d[i + 3] = 255
    }
  }
  return d
}

function filterFor(w, h, r) {
  const key = `${w}x${h}x${r}`
  const id = `bt-glass-${key}`
  if (cache.has(key)) { cache.delete(key); cache.set(key, id); return id }
  if (!defs) {
    defs = document.createElementNS(NS, 'svg')
    defs.setAttribute('class', 'glass-defs')
    defs.setAttribute('aria-hidden', 'true')
    document.body.appendChild(defs)
  }
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  c.getContext('2d').putImageData(new ImageData(lensData(w, h, r), w, h), 0, 0)
  const f = document.createElementNS(NS, 'filter')
  f.id = id
  Object.entries({ x: 0, y: 0, width: w, height: h, filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' }).forEach(([k, v]) => f.setAttribute(k, v))
  // two layers in one filter: the rim (B) shows the bent backdrop almost sharp, the core a frosted one, so
  // the bend reads at the edge while the words sit on a quiet ground. A flat map under the image: until
  // it decodes nothing moves and it is all core.
  f.innerHTML = `<feFlood flood-color="rgb(128,128,0)" result="flat"/>
    <feImage href="${c.toDataURL()}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="map"/>
    <feComposite in="map" in2="flat" operator="over" result="lens"/>
    <feDisplacementMap in="SourceGraphic" in2="lens" scale="${DEPTH * 2}" xChannelSelector="R" yChannelSelector="G" result="bent"/>
    <feGaussianBlur in="bent" stdDeviation="0.75" result="rim"/>
    <feColorMatrix in="lens" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 1 0 0" result="weight"/>
    <feComposite in="rim" in2="weight" operator="in" result="rimOnly"/>
    <feGaussianBlur in="SourceGraphic" stdDeviation="16" edgeMode="duplicate" result="core"/>
    <feComposite in="rimOnly" in2="core" operator="over"/>`
  defs.appendChild(f)
  cache.set(key, id)
  // shortcut: keeps the 24 most recent sizes; a panel whose size changes constantly would churn maps
  if (cache.size > 24) {
    const old = [...cache].find(([, oldId]) => !inUse.get(oldId))
    if (old) { cache.delete(old[0]); document.getElementById(old[1])?.remove() }
  }
  return id
}

// Points a panel at the lens for its own size (re-measured when it resizes). Call with the panel's ref.
// The lens is costly to draw: Chrome re-runs it on every frame that anything in the panel moves. So it is
// laid only while the panel is still. While the panel opens, scrolls, resizes or its bubble glides, the
// plain frost (the same blur) stands in, and the bent rim comes back a moment after it all comes to rest.
// The lens map is built at that moment too, never on the frame the panel opens.
const SETTLE = 240 // ms of stillness before the lens is laid again
export function useGlass(ref, on = true) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!chromium || !on || !el) return
    let cur = null, timer = 0, gone = false
    const use = (id) => { if (cur) inUse.set(cur, inUse.get(cur) - 1); cur = id; if (id) inUse.set(id, (inUse.get(id) || 0) + 1) }
    const lay = () => {
      timer = 0
      if (gone) return
      // still moving (a transition or animation in the panel, its bubble included): wait for it
      if (el.getAnimations({ subtree: true }).some((a) => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity)) return settle()
      const w = el.offsetWidth, h = el.offsetHeight // layout size, unaffected by the open animation's scale
      if (!w || !h) return
      const r = Math.round(Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, w / 2, h / 2))
      const id = filterFor(w, h, r)
      if (id !== cur) use(id)
      el.style.setProperty('--glass-lens', `url(#${id})`)
    }
    const settle = () => { clearTimeout(timer); timer = setTimeout(lay, SETTLE) }
    const moving = () => { el.style.removeProperty('--glass-lens'); settle() }
    settle()
    const ro = new ResizeObserver(moving)
    ro.observe(el)
    // captured, so a scroll inside the list and its options' transitions count too
    const EVENTS = ['transitionrun', 'animationstart', 'scroll']
    EVENTS.forEach((e) => el.addEventListener(e, moving, true))
    return () => {
      gone = true
      clearTimeout(timer)
      ro.disconnect()
      EVENTS.forEach((e) => el.removeEventListener(e, moving, true))
      el.style.removeProperty('--glass-lens')
      use(null)
    }
  }, [ref, on])
}

// Places a floating panel (drawn in a portal, position: fixed) against its anchor: below, or above when
// there is no room (or `up` prefers above). Follows the anchor on scroll and resize, closes once the anchor
// is off screen or on a press outside both. `cap` limits the panel's height; the room left becomes maxHeight.
export function useFloating(open, close, anchor, panel, { up = false, align = 'end', gap = 6, cap } = {}) {
  const [pos, setPos] = useState(null)
  useLayoutEffect(() => {
    if (!open) return setPos(null)
    // the anchor's nearest scrolling box (a modal body, say): the panel also closes once the anchor scrolls out of it
    let scroller = anchor.current?.parentElement
    while (scroller && scroller !== document.body && !/auto|scroll/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement
    if (scroller === document.body) scroller = null
    const place = () => {
      const a = anchor.current, p = panel.current
      if (!a) return
      const r = a.getBoundingClientRect()
      const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight
      const c = scroller?.getBoundingClientRect()
      if (r.bottom < Math.max(0, c?.top ?? 0) || r.top > Math.min(vh, c?.bottom ?? vh)) return close()
      const full = p ? (cap ? Math.min(p.scrollHeight, cap) : p.offsetHeight) : 0
      const w = p?.offsetWidth ?? 240
      const roomBelow = vh - r.bottom - gap - 8, roomAbove = r.top - gap - 8
      const below = up ? full > roomAbove && roomBelow > roomAbove : full <= roomBelow || roomBelow >= roomAbove
      const h = Math.min(full, below ? roomBelow : roomAbove)
      const left = Math.min(Math.max(16, align === 'start' ? r.left : r.right - w), vw - w - 16) // the page's 16px side gutter
      setPos({ top: below ? r.bottom + gap : r.top - gap - h, left, up: !below, width: r.width, maxHeight: cap ? Math.max(120, Math.min(cap, below ? roomBelow : roomAbove)) : undefined })
    }
    place()
    const raf = requestAnimationFrame(place) // again once the panel has its real size
    const ro = new ResizeObserver(place)
    if (panel.current) ro.observe(panel.current)
    const onScroll = (e) => { if (!panel.current?.contains(e.target)) place() }
    // a press outside closes the panel and goes no further, like a system popup: a press on a modal's
    // dimmed backdrop closes the list, not the modal with the form typed into it. On another <select> the
    // default is stopped too, or (with its own handler skipped) it would open the system popup
    const away = (e) => {
      if (anchor.current?.contains(e.target) || panel.current?.contains(e.target)) return
      e.stopPropagation()
      if (e.target.closest?.('select')) e.preventDefault()
      close()
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', place)
    document.addEventListener('mousedown', away, true)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', place)
      document.removeEventListener('mousedown', away, true)
    }
    // close is a fresh function each render; the listeners only need the latest open state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  return pos
}

// The style a floating panel needs from useFloating's result (hidden off screen until placed)
export const floatStyle = (pos, extra) => ({ top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos ? 'visible' : 'hidden', maxHeight: pos?.maxHeight, ...extra })
