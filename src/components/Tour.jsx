import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TOURS, place } from '../lib/tours'
import '../styles/tour.css'

// The guided tour: <Tour role="admin" | "recruiter" open={bool} onClose={() => {}} />
// A liquid lens (the spotlight) dims the page round each step's target and glides from one to the next,
// its leading edges first; a liquid-glass card sits beside it and flows to its next size.
// Everything that moves is cheap to draw (GPU blur, transforms, opacity): no software lens here.
// Steps are data in src/lib/tours.js. The page underneath is inert while the tour runs.

const PAD = 8 // spotlight round the target
const WAIT = 3000 // how long a step waits for its target
const RING = 2
const GLIDE = 560 // ms the lens and card take between steps (tour.css)
const MORPH = 420 // ms the card takes to reach its next height
const reducedNow = () => document.documentElement.dataset.motion === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches

const isVisible = (el) => {
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && (!el.checkVisibility || el.checkVisibility({ visibilityProperty: true }))
}
const find = (target) => {
  for (const sel of [].concat(target || [])) {
    let all = []
    try { all = [...document.querySelectorAll(sel)] } catch { /* a selector the browser cannot parse */ }
    const el = all.find(isVisible)
    if (el) return el
  }
  return null
}
// Checks every frame until fn returns something, or gives up with null
const until = (fn, ms, alive) => new Promise((done) => {
  const end = performance.now() + ms
  const tick = () => {
    const v = alive() ? fn() : null
    if (v || !alive() || performance.now() > end) return done(v || null)
    requestAnimationFrame(tick)
  }
  tick()
})
const pageOf = (hash) => hash.replace(/^#/, '') || 'dashboard'

export default function Tour({ role, open, onClose }) {
  const steps = TOURS[role] ?? TOURS.recruiter
  const [want, setWant] = useState(0) // the step asked for
  const [shown, setShown] = useState(-1) // the step on screen once its target is found
  const [closing, setClosing] = useState(false)
  const rootRef = useRef(null)
  const spotRef = useRef(null)
  const cardRef = useRef(null)
  const paneRef = useRef(null)
  const nextRef = useRef(null)
  const target = useRef(null)
  const glideUntil = useRef(0)
  const placed = useRef(false)
  const pending = useRef(false) // a step is waiting for its page or target
  const lastBox = useRef(null)
  const paneH = useRef(0) // the card's height at the last step, so the next one can grow or shrink from it
  const cardH = useRef(0) // the card's settled height, used for placing it while its height is moving
  const start = useRef({ hash: '', opener: null })

  // Open and close: remember where the person was, make the page inert
  useEffect(() => {
    if (!open) return
    start.current = { hash: location.hash, opener: document.activeElement }
    setWant(0); setShown(-1); setClosing(false)
    placed.current = false
    target.current = null
    lastBox.current = null
    const app = document.getElementById('root')
    if (app) app.inert = true
    document.documentElement.dataset.touring = '' // App skips its page cross-fade meanwhile
    return () => {
      delete document.documentElement.dataset.touring
      // reset now, so a reopen never runs the step effect with the old step
      setWant(0); setShown(-1)
      if (app) app.inert = false
      // focus only works once the page is no longer inert; the opener was a menu item that has
      // since closed, so fall back to the profile button (or More on a phone)
      const { opener } = start.current
      const back = opener?.isConnected && opener !== document.body && isVisible(opener) ? opener : find(['.profile-trigger', '.more-btn'])
      back?.focus()
    }
  }, [open])

  // Each step: open its page, wait for its target, bring it into view
  useEffect(() => {
    if (!open) return
    const step = steps[want]
    let live = true
    const alive = () => live
    pending.current = true
    ;(async () => {
      if (step.page && pageOf(location.hash) !== step.page) {
        const main = document.querySelector('main.content')
        const old = main?.firstElementChild
        location.hash = step.page
        await until(() => main?.firstElementChild !== old, 1500, alive)
      }
      // give the first choice a moment to load (table rows arrive after the page) before taking a fallback
      const first = [].concat(step.target || [])[0]
      const el = step.target ? (await until(() => find(first), WAIT / 2, alive)) || (await until(() => find(step.target), WAIT / 2, alive)) : null
      if (!live) return
      if (el) {
        const r = el.getBoundingClientRect()
        const vh = document.documentElement.clientHeight
        if (r.top < PAD + 16 || r.bottom > vh - PAD - 16) {
          // the page glides to the next target (the lens rides along), then the lens flows onto it
          const reduced = reducedNow()
          el.scrollIntoView({ block: r.height > vh * 0.6 ? 'start' : 'center', behavior: reduced ? 'instant' : 'smooth' })
          if (!reduced) {
            let y = NaN, still = 0
            await until(() => { const t = el.getBoundingClientRect().top; still = Math.abs(t - y) < 0.5 ? still + 1 : 0; y = t; return still >= 3 }, 900, alive)
          }
        }
      }
      target.current = el
      pending.current = false
      if (placed.current) glideUntil.current = performance.now() + GLIDE
      setShown(want)
    })()
    return () => { live = false }
  }, [open, want, steps])

  // Follow the target every frame (scroll, resize, data arriving), writing styles directly.
  // Between steps the lens glides (CSS transitions on its four edges); otherwise it follows at once.
  useEffect(() => {
    if (!open) return
    let raf = 0
    let last = ''
    let gliding = false
    let prev = null
    const radius = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--radius')) || 12) + 4
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const card = cardRef.current, spot = spotRef.current
      if (!card || !spot) return
      const glide = performance.now() < glideUntil.current
      if (glide !== gliding) { gliding = glide; rootRef.current.toggleAttribute('data-glide', glide) }
      const vw = document.documentElement.clientWidth
      const vh = document.documentElement.clientHeight
      const el = target.current
      let box = null
      if (el && el.isConnected && isVisible(el)) {
        const r = el.getBoundingClientRect()
        // kept inside the screen so the ring always shows whole
        const x = Math.max(r.left - PAD, RING), y = Math.max(r.top - PAD, RING)
        box = { x, y, w: Math.min(r.right + PAD, vw - RING) - x, h: Math.min(r.bottom + PAD, vh - RING) - y }
        if (box.w <= 0 || box.h <= 0) box = null // scrolled right off the screen: the card centres until it is back
      }
      // the old page unmounted while the next step waits: hold the lens where it was, then glide
      if (pending.current) box = box || lastBox.current
      else lastBox.current = box
      // while the card's height flows to the next step, place it by where it will settle
      const morphing = paneRef.current?.getAnimations().some((a) => a.id === 'tour-morph')
      if (!morphing) cardH.current = card.offsetHeight
      const size = { w: card.offsetWidth, h: cardH.current || card.offsetHeight }
      const key = [box ? [box.x, box.y, box.w, box.h].map(Math.round) : 'none', size.w, size.h, vw, vh].join()
      if (key === last) return
      last = key
      // no target: the lens shrinks to a point in the middle and its ring fades
      const b = box || { x: vw / 2, y: vh / 2, w: 0, h: 0 }
      if (prev && glide) {
        // the edge it moves toward leads, the other trails (as in Liquid.jsx)
        if (b.y !== prev.y) spot.dataset.y = b.y > prev.y ? 'down' : 'up'
        if (b.x !== prev.x) spot.dataset.x = b.x > prev.x ? 'right' : 'left'
      }
      prev = b
      const st = spot.style
      st.top = `${b.y}px`; st.left = `${b.x}px`
      st.right = `${vw - b.x - b.w}px`; st.bottom = `${vh - b.y - b.h}px`
      st.borderRadius = `${box ? radius : 0}px`
      spot.toggleAttribute('data-empty', !box)
      const p = place(box, size, vw, vh)
      card.style.transform = `translate3d(${Math.round(p.x)}px, ${Math.round(p.y)}px, 0)`
      card.dataset.side = p.side
      if (card.dataset.ready) placed.current = true
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [open])

  // Each new step the glass flows to its new height (before paint, so it never snaps) and gives a small
  // liquid wobble as its words change. Height on one small card and a transform: both cheap to draw.
  useLayoutEffect(() => {
    const pane = paneRef.current, card = cardRef.current
    if (!open || shown < 0 || !pane || !card) return
    const to = pane.offsetHeight, from = paneH.current
    paneH.current = to
    cardH.current = card.offsetHeight
    if (!placed.current || !from || reducedNow()) return
    if (Math.abs(from - to) > 1) pane.animate([{ height: `${from}px` }, { height: `${to}px` }], { id: 'tour-morph', duration: MORPH, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })
    pane.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.985, 0.975)', offset: 0.3 }, { transform: 'scale(1.006, 1.008)', offset: 0.62 }, { transform: 'scale(1)' }], { duration: GLIDE, easing: 'ease-out', composite: 'add' })
  }, [open, shown])

  const finish = () => {
    if (closing) return
    setClosing(true)
    const reduced = reducedNow()
    setTimeout(() => {
      const { hash } = start.current
      if (pageOf(location.hash) !== pageOf(hash)) location.hash = hash.replace(/^#/, '') || 'dashboard'
      onClose() // focus goes back in the open effect's cleanup
    }, reduced ? 0 : 120)
  }
  const last = steps.length - 1
  const next = () => (shown >= last ? finish() : setWant(Math.min(shown + 1, last)))
  const back = () => setWant(Math.max(shown - 1, 0))

  // Keys: Right or Enter next, Left back, Esc closes, Tab stays inside the card
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      const inButton = e.target.closest?.('.tour-card button')
      if (e.key === 'Escape') finish()
      else if (e.key === 'ArrowRight' || (e.key === 'Enter' && !inButton)) next()
      else if (e.key === 'ArrowLeft') back()
      else if (e.key === 'Tab') {
        const items = [...(cardRef.current?.querySelectorAll('button:not([disabled])') ?? [])].filter(isVisible)
        if (!items.length) return
        const i = items.indexOf(document.activeElement)
        e.preventDefault()
        items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus()
        return
      } else return
      e.preventDefault()
      e.stopPropagation()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  })

  // Focus moves into the card, and stays there when a button it was on disappears
  useEffect(() => {
    if (open && shown >= 0 && !cardRef.current?.contains(document.activeElement)) nextRef.current?.focus({ preventScroll: true })
  }, [open, shown])

  if (!open) return null
  const step = steps[shown]
  const label = role === 'admin' ? 'Admin tour' : 'Recruiter tour'
  return createPortal(
    <div className="tour" ref={rootRef} data-closing={closing || undefined}>
      {/* clicks on the dimmed page, and on the spotlit element, do nothing */}
      <div className="tour-shield" onMouseDown={(e) => e.preventDefault()} />
      <div className="tour-spot" ref={spotRef} data-y="down" data-x="right" data-empty aria-hidden />
      <div
        className="tour-card"
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={step ? `${label}: ${step.title}` : label}
        aria-describedby={step ? 'tour-body' : undefined}
        data-ready={step ? true : undefined}
      >
        <div className="glass tour-pane" ref={paneRef}>
        <span className="tour-sheen" aria-hidden />
        {step && (
          <div className="tour-inner" key={shown}>
            <div className="tour-top">
              <span className="tour-count">Step {shown + 1} of {steps.length}</span>
              <button type="button" className="btn ghost small tour-skip" onClick={finish}>Skip tour</button>
            </div>
            <h2 className="tour-title">{step.title}</h2>
            <p className="tour-body" id="tour-body">{step.body}</p>
            <div className="tour-foot">
              <ol className="tour-dots" aria-hidden>
                {steps.map((s, n) => <li key={s.id} data-state={n === shown ? 'on' : n < shown ? 'done' : undefined} />)}
              </ol>
              <div className="tour-actions">
                {shown > 0 && <button type="button" className="btn ghost" onClick={back}>Back</button>}
                <button type="button" className="btn primary" ref={nextRef} onClick={next}>{shown === last ? 'Done' : 'Next'}</button>
              </div>
            </div>
          </div>
        )}
        </div>
        {/* inside the modal so screen readers that honour aria-modal still speak it */}
        <p className="tour-live" aria-live="polite">{step ? `${label}, step ${shown + 1} of ${steps.length}: ${step.title}` : ''}</p>
      </div>
    </div>,
    document.body,
  )
}
