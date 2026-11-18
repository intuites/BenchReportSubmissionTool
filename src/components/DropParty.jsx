import { useEffect, useRef } from 'react'
import { burst } from './Liquid'

// A little game for whoever rests on one day for seven seconds: the day's drop bursts into bubbles of
// liquid that bounce round the calendar. They fall, squash flat where they hit, stretch as they fly and
// hop off the floor; two that touch may merge into one bigger drop, a big one that slams the floor splits
// in two, and a day a bubble splashes jumps. Then they all flow back into the day, which bursts big.
// Purely for fun: it changes nothing and lets every click through. Cheap to draw: the bubbles move by
// transform only, from one requestAnimationFrame loop, and the days are measured once.
const POOL = 18 // most bubbles at once (splits make more)
const START = 10
const PLAY = 4400 // ms of play before they gather
const GATHER = 1700 // ms at most to flow home
const GRAVITY = 1500 // px/s²

export default function DropParty({ box, day, onDone }) {
  const layer = useRef(null)
  useEffect(() => {
    const root = layer.current, area = box.current
    const cell = area?.querySelector(`[data-day="${day}"]`)
    if (!root || !area || !cell) return onDone()
    const W = area.clientWidth, H = area.clientHeight
    const a = area.getBoundingClientRect(), c = cell.getBoundingClientRect()
    const home = { x: c.left - a.left + c.width / 2, y: c.top - a.top + c.height / 2 }
    // where each day sits, measured once, so a splash finds its day without asking the page again
    const days = [...area.querySelectorAll('.cal-day:not(.disabled)')].map((el) => {
      const r = el.getBoundingClientRect()
      return { el, x1: r.left - a.left, y1: r.top - a.top, x2: r.right - a.left, y2: r.bottom - a.top }
    })
    const splash = (x, y) => {
      const d = days.find((k) => x >= k.x1 && x <= k.x2 && y >= k.y1 && y <= k.y2)
      if (!d || d.el.classList.contains('splash')) return
      d.el.classList.add('splash')
      d.el.addEventListener('animationend', () => d.el.classList.remove('splash'), { once: true })
    }
    burst(cell)
    root.dispatchEvent(new CustomEvent('liquidmove', { bubbles: true })) // the panel's glass rests while they play

    const nodes = [...root.children]
    const bubbles = []
    const spawn = (x, y, r, vx, vy) => {
      const el = nodes.find((n) => !n.dataset.on)
      if (!el) return null
      el.dataset.on = '1'
      el.style.width = el.style.height = `${r * 2}px`
      const b = { el, r, x, y, vx, vy, hit: 0, axis: 'y', calm: 0.25 }
      bubbles.push(b)
      return b
    }
    const resize = (b, r) => { b.r = r; b.el.style.width = b.el.style.height = `${r * 2}px` }
    const drop = (b) => { delete b.el.dataset.on; b.el.style.transform = 'scale(0)'; bubbles.splice(bubbles.indexOf(b), 1) }
    // a fountain out of the day: mostly upward, fanned out
    for (let i = 0; i < START; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.6
      const speed = 320 + Math.random() * 380
      spawn(home.x, home.y, 6 + Math.random() * 8, Math.cos(ang) * speed, Math.sin(ang) * speed)
    }

    const start = performance.now()
    let last = start, raf = 0, done = false
    const finish = () => {
      if (done) return
      done = true
      burst(cell, { beads: 18, reach: 1.6 })
      onDone()
    }
    const step = (now) => {
      const dt = Math.min(0.032, (now - last) / 1000)
      last = now
      const t = now - start
      const gathering = t > PLAY
      let atHome = 0
      for (const b of [...bubbles]) {
        b.calm = Math.max(0, b.calm - dt)
        if (!gathering) {
          b.vy += GRAVITY * dt
          b.x += b.vx * dt
          b.y += b.vy * dt
          if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.8; b.hit = 0.45; b.axis = 'x'; splash(b.x, b.y) }
          if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * 0.8; b.hit = 0.45; b.axis = 'x'; splash(b.x, b.y) }
          if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy) * 0.8; b.hit = 0.45; b.axis = 'y' }
          if (b.y > H - b.r) {
            const slam = Math.abs(b.vy)
            b.y = H - b.r
            b.vy = -slam * 0.72
            b.vx *= 0.94
            b.hit = 0.5
            b.axis = 'y'
            splash(b.x, b.y - b.r - 4)
            // a big drop that slams the floor splits in two (the same water, two smaller drops)
            if (slam > 650 && b.r > 10 && b.calm === 0 && bubbles.length < POOL) {
              const r = b.r / Math.cbrt(2)
              resize(b, r)
              b.calm = 0.4
              b.vx -= 120
              const twin = spawn(b.x, b.y, r, b.vx + 240, b.vy * 0.9)
              if (twin) twin.calm = 0.4
            }
            // nearly still on the floor: it hops off again, somewhere new
            if (Math.abs(b.vy) < 180) { b.vy = -(480 + Math.random() * 420); b.vx += (Math.random() - 0.5) * 340 }
          }
        } else {
          // a spring pulls each one home to the day, a little underdamped so they swirl in
          const k = 110, z = 0.62
          b.vx += (k * (home.x - b.x) - 2 * Math.sqrt(k) * z * b.vx) * dt
          b.vy += (k * (home.y - b.y) - 2 * Math.sqrt(k) * z * b.vy) * dt
          b.x += b.vx * dt
          b.y += b.vy * dt
        }
      }
      // two drops that touch may run together into one (their water added up)
      if (!gathering) {
        for (let i = 0; i < bubbles.length; i++) {
          for (let j = i + 1; j < bubbles.length; j++) {
            const p = bubbles[i], q = bubbles[j]
            if (p.calm || q.calm) continue
            if (Math.hypot(p.x - q.x, p.y - q.y) < (p.r + q.r) * 0.8 && p.r + q.r < 26) {
              const m1 = p.r ** 3, m2 = q.r ** 3
              p.vx = (p.vx * m1 + q.vx * m2) / (m1 + m2)
              p.vy = (p.vy * m1 + q.vy * m2) / (m1 + m2)
              p.x = (p.x * m1 + q.x * m2) / (m1 + m2)
              p.y = (p.y * m1 + q.y * m2) / (m1 + m2)
              resize(p, Math.cbrt(m1 + m2))
              p.hit = 0.5
              p.calm = 0.5
              drop(q)
              j--
            }
          }
        }
      }
      for (const b of bubbles) {
        b.hit *= Math.pow(0.0004, dt) // the squash from a hit springs back within a few frames
        const dist = Math.hypot(home.x - b.x, home.y - b.y)
        if (gathering && dist < 5) atHome++
        // flattened against what it hit, otherwise stretched along its flight
        let tf
        if (b.hit > 0.04) {
          const s = 1 + b.hit
          tf = b.axis === 'y' ? `scale(${s.toFixed(3)}, ${(1 / s).toFixed(3)})` : `scale(${(1 / s).toFixed(3)}, ${s.toFixed(3)})`
        } else {
          const speed = Math.hypot(b.vx, b.vy)
          const st = 1 + Math.min(0.55, speed / 1500)
          tf = `rotate(${Math.atan2(b.vy, b.vx).toFixed(3)}rad) scale(${st.toFixed(3)}, ${(1 / st).toFixed(3)})`
        }
        const shrink = gathering ? Math.max(0.1, Math.min(1, dist / 46)) : 1
        b.el.style.transform = `translate3d(${(b.x - b.r).toFixed(1)}px, ${(b.y - b.r).toFixed(1)}px, 0) ${tf} scale(${shrink.toFixed(3)})`
      }
      if ((gathering && atHome === bubbles.length) || t > PLAY + GATHER) return finish()
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => {
      done = true
      cancelAnimationFrame(raf)
      days.forEach((d) => d.el.classList.remove('splash'))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="drop-party" ref={layer} data-moving aria-hidden>
      {Array.from({ length: POOL }, (_, i) => <i key={i} />)}
    </div>
  )
}
