import { useEffect, useRef } from 'react'
import { burst } from './Liquid'

// A little game for whoever rests on one day for seven seconds: the day's drop bursts into bubbles of
// liquid that bounce round the calendar (falling, squashing flat where they hit, stretching as they fly,
// hopping off the floor), then flow back, shrink into the day and burst once more. Purely for fun: it
// changes nothing, lets every click through, and the Reduce motion switch turns it off (Calendar).
const BUBBLES = 10
const PLAY = 4200 // ms of bouncing before they gather
const GATHER = 1600 // ms at most to flow home
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
    burst(cell)
    root.dispatchEvent(new CustomEvent('liquidmove', { bubbles: true })) // the panel's glass rests while they play

    const bs = [...root.children].map((el) => {
      const r = 6 + Math.random() * 9
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.6 // mostly upward, fanned out
      const speed = 300 + Math.random() * 360
      el.style.width = el.style.height = `${r * 2}px`
      return { el, r, x: home.x, y: home.y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, hit: 0, axis: 'y' }
    })

    const start = performance.now()
    let last = start, raf = 0, done = false
    const finish = () => {
      if (done) return
      done = true
      burst(cell)
      onDone()
    }
    const step = (now) => {
      const dt = Math.min(0.032, (now - last) / 1000)
      last = now
      const t = now - start
      const gathering = t > PLAY
      let home_ = 0
      for (const b of bs) {
        if (!gathering) {
          b.vy += GRAVITY * dt
          b.x += b.vx * dt
          b.y += b.vy * dt
          if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.8; b.hit = 0.45; b.axis = 'x' }
          if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * 0.8; b.hit = 0.45; b.axis = 'x' }
          if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy) * 0.8; b.hit = 0.45; b.axis = 'y' }
          if (b.y > H - b.r) {
            b.y = H - b.r
            b.vy = -Math.abs(b.vy) * 0.72
            b.vx *= 0.94
            b.hit = 0.5
            b.axis = 'y'
            // nearly still on the floor: it hops off again, somewhere new
            if (Math.abs(b.vy) < 180) { b.vy = -(460 + Math.random() * 420); b.vx += (Math.random() - 0.5) * 320 }
          }
        } else {
          // a spring pulls each one home to the day, a little underdamped so they swirl in
          const k = 110, z = 0.62
          b.vx += (k * (home.x - b.x) - 2 * Math.sqrt(k) * z * b.vx) * dt
          b.vy += (k * (home.y - b.y) - 2 * Math.sqrt(k) * z * b.vy) * dt
          b.x += b.vx * dt
          b.y += b.vy * dt
        }
        b.hit *= Math.pow(0.0004, dt) // the squash from a hit springs back within a few frames
        const dist = Math.hypot(home.x - b.x, home.y - b.y)
        if (gathering && dist < 5) home_++
        // flattened against what it hit, otherwise stretched along its flight
        let tf
        if (b.hit > 0.04) {
          const s = 1 + b.hit
          tf = b.axis === 'y' ? `scale(${s}, ${1 / s})` : `scale(${1 / s}, ${s})`
        } else {
          const speed = Math.hypot(b.vx, b.vy)
          const st = 1 + Math.min(0.55, speed / 1500)
          tf = `rotate(${Math.atan2(b.vy, b.vx).toFixed(3)}rad) scale(${st.toFixed(3)}, ${(1 / st).toFixed(3)})`
        }
        const shrink = gathering ? Math.max(0.1, Math.min(1, dist / 46)) : 1
        b.el.style.transform = `translate3d(${(b.x - b.r).toFixed(1)}px, ${(b.y - b.r).toFixed(1)}px, 0) ${tf} scale(${shrink.toFixed(3)})`
      }
      if ((gathering && home_ === bs.length) || t > PLAY + GATHER) return finish()
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => { done = true; cancelAnimationFrame(raf) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="drop-party" ref={layer} data-moving aria-hidden>
      {Array.from({ length: BUBBLES }, (_, i) => <i key={i} />)}
    </div>
  )
}
