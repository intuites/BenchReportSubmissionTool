import { useEffect, useRef } from 'react'
import { burst } from './Liquid'

// Press and hold the mouse on one day for thirty seconds and the drop comes alive: a little glossy drop with an emoji face
// pops out of the day, blinks, looks round, then hops from day to day (stretching as it jumps, squashing
// as it lands, each day it lands on bounces), waves, bounces higher and higher, flips, hops home to today,
// waves goodbye and melts into today's tile. Purely for fun: it changes nothing and lets every click
// through. One requestAnimationFrame loop writes its transform; the wave and the floating emoji are CSS.
const SIZE = 34
const HOP = 470 // ms a hop takes
const HOP_HEIGHT = 44 // px at the top of a hop

// Its face is an emoji that changes with what it is doing, and each show takes the next of these casts,
// so it is never the same pet twice running. Each act also sends a little emoji floating up.
const CASTS = [
  { appear: '😮', look: '🤔', hop: '😆', wave: '😄', bounce: '😝', flip: '🤩', bye: '😘', melt: '🫠', pops: { appear: '✨', wave: '👋', bounce: '💦', flip: '🎉', bye: '💚' } },
  { appear: '🐣', look: '👀', hop: '🐥', wave: '🐤', bounce: '🐥', flip: '🐔', bye: '🐣', melt: '🥚', pops: { appear: '🌼', wave: '👋', bounce: '🌱', flip: '🌟', bye: '🌷' } },
  { appear: '😺', look: '😼', hop: '😸', wave: '😺', bounce: '😹', flip: '😻', bye: '😽', melt: '😿', pops: { appear: '🐾', wave: '👋', bounce: '🧶', flip: '✨', bye: '💤' } },
  { appear: '🥳', look: '🧐', hop: '😜', wave: '😁', bounce: '🤪', flip: '🤩', bye: '🥰', melt: '😵‍💫', pops: { appear: '🎈', wave: '🙌', bounce: '🎶', flip: '🎊', bye: '🎁' } },
  { appear: '👻', look: '👀', hop: '👻', wave: '😊', bounce: '😜', flip: '🤩', bye: '😇', melt: '💨', pops: { appear: '✨', wave: '👋', bounce: '🌀', flip: '⭐', bye: '🌙' } },
  { appear: '🐸', look: '🤨', hop: '🐸', wave: '😄', bounce: '😆', flip: '🤸', bye: '😙', melt: '💧', pops: { appear: '🪷', wave: '👋', bounce: '💦', flip: '🏆', bye: '🍀' } },
  { appear: '🤖', look: '🧐', hop: '😎', wave: '🤖', bounce: '🕺', flip: '🚀', bye: '🫡', melt: '🔋', pops: { appear: '⚡', wave: '👋', bounce: '🎵', flip: '🛸', bye: '📡' } },
]
const CAST_KEY = 'bt-pet-cast'
const nextCast = () => {
  let i = 0
  try { i = (Number(localStorage.getItem(CAST_KEY)) + 1) % CASTS.length || 0; localStorage.setItem(CAST_KEY, String(i)) } catch { i = Math.floor(Math.random() * CASTS.length) }
  return CASTS[i]
}

const ease = (t) => 1 - (1 - t) ** 3
const arc = (t) => 4 * t * (1 - t) // 0 → 1 → 0 over a hop

export default function DropPet({ box, day, home, onDone }) {
  const pet = useRef(null)
  useEffect(() => {
    const el = pet.current, area = box.current
    if (!el || !area) return onDone()
    const cast = nextCast()
    const face = el.querySelector('.pet-face')
    const floatUp = (text) => {
      const f = document.createElement('i')
      f.className = 'pet-pop'
      f.textContent = text
      el.appendChild(f)
      f.addEventListener('animationend', () => f.remove(), { once: true })
    }
    const a = area.getBoundingClientRect()
    const cells = [...area.querySelectorAll('.cal-day:not(.disabled):not(.out)')]
    const at = (d) => {
      const c = area.querySelector(`[data-day="${d}"]`) || cells[0]
      const r = c.getBoundingClientRect()
      return { x: r.left - a.left + r.width / 2, y: r.bottom - a.top - 4, el: c } // feet on the day's floor
    }
    const pick = (not) => {
      const pool = cells.filter((c) => c.dataset.day !== not)
      return pool[Math.floor(Math.random() * pool.length)]?.dataset.day ?? not
    }
    const bounceDay = (c) => {
      if (!c || c.classList.contains('splash')) return
      c.classList.add('splash')
      c.addEventListener('animationend', () => c.classList.remove('splash'), { once: true })
    }
    const ring = (p) => {
      const r = document.createElement('i')
      r.className = 'pet-ripple'
      r.style.transform = `translate3d(${(p.x - 22).toFixed(0)}px, ${(p.y - 8).toFixed(0)}px, 0)`
      el.parentElement?.appendChild(r)
      r.addEventListener('animationend', () => r.remove(), { once: true })
    }

    // the show, as a list of acts; each knows how long it takes and how to pose the pet at any moment
    const acts = []
    let spot = day
    const add = (act) => acts.push(act)
    add({ kind: 'appear', dur: 560, from: spot })
    add({ kind: 'look', dur: 1000, from: spot })
    for (let i = 0; i < 4; i++) { const to = pick(spot); add({ kind: 'hop', dur: HOP, from: spot, to }); spot = to }
    add({ kind: 'wave', dur: 1100, from: spot })
    add({ kind: 'bounce', dur: 1000, from: spot })
    add({ kind: 'flip', dur: 760, from: spot })
    // home to today, a hop or two at a time across the grid
    if (spot !== home) { const mid = pick(home); add({ kind: 'hop', dur: HOP, from: spot, to: mid }); add({ kind: 'hop', dur: HOP, from: mid, to: home }); spot = home }
    add({ kind: 'bye', dur: 1000, from: home })
    add({ kind: 'melt', dur: 520, from: home })
    acts.forEach((x) => { x.p0 = at(x.from); x.p1 = x.to ? at(x.to) : x.p0 })
    const total = acts.reduce((n, x) => n + x.dur, 0)

    burst(at(day).el)
    el.dispatchEvent(new CustomEvent('liquidmove', { bubbles: true })) // the panel's glass rests while it plays
    const start = performance.now()
    let raf = 0, done = false, current = -1
    const pose = (x, y, sx, sy, rot, look) => {
      el.style.transform = `translate3d(${(x - SIZE / 2).toFixed(1)}px, ${(y - SIZE).toFixed(1)}px, 0) rotate(${rot.toFixed(1)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`
      el.style.setProperty('--look', look.toFixed(2))
    }
    const step = (now) => {
      if (done) return
      let t = now - start
      if (t >= total) { done = true; onDone(); return }
      let i = 0
      while (t >= acts[i].dur) { t -= acts[i].dur; i++ }
      const act = acts[i], k = t / act.dur, { p0, p1 } = act
      if (i !== current) {
        // entering an act: its look, and the landing of the hop before it
        if (current >= 0 && acts[current].kind === 'hop') { bounceDay(acts[current].p1.el); ring(acts[current].p1) }
        current = i
        el.dataset.act = act.kind
        face.textContent = cast[act.kind] || cast.appear
        if (cast.pops[act.kind]) floatUp(cast.pops[act.kind])
      }
      switch (act.kind) {
        case 'appear': { // pops out of the day: squashed, overshoots, settles
          const s = ease(Math.min(1, k * 1.4)) * (1 + 0.18 * Math.sin(k * Math.PI * 2) * (1 - k))
          pose(p0.x, p0.y, s * (1 + 0.2 * (1 - k)), s * (1 - 0.15 * (1 - k)), 0, 0)
          break
        }
        case 'look': { // looks left, then right, with a little bob
          const look = Math.sin(k * Math.PI * 2)
          pose(p0.x, p0.y - Math.abs(Math.sin(k * Math.PI * 3)) * 3, 1, 1, look * 4, look)
          break
        }
        case 'hop': { // stretch on take-off, round at the top, squash on landing
          const x = p0.x + (p1.x - p0.x) * k, y = p0.y + (p1.y - p0.y) * k - arc(k) * HOP_HEIGHT
          const stretch = k < 0.18 ? 1 + 0.25 * (k / 0.18) : k > 0.82 ? 1 + 0.25 * ((1 - k) / 0.18) : 1.25 - 0.25 * arc((k - 0.18) / 0.64)
          pose(x, y, 1 / stretch, stretch, (p1.x - p0.x) * 0.05 * (0.5 - k), Math.sign(p1.x - p0.x))
          break
        }
        case 'wave': case 'bye': { // stands and waves (the arm is CSS)
          pose(p0.x, p0.y - Math.abs(Math.sin(k * Math.PI * 4)) * 2, 1, 1, Math.sin(k * Math.PI * 4) * 5, 0)
          break
        }
        case 'bounce': { // three bounces, each higher
          const n = Math.min(2, Math.floor(k * 3)), local = k * 3 - n
          const h = [14, 24, 36][n] * arc(local)
          const squash = local < 0.12 || local > 0.88 ? 1.2 : 1
          pose(p0.x, p0.y - h, squash, 1 / squash, 0, 0)
          break
        }
        case 'flip': { // a big jump with a full turn
          const h = arc(k) * 70
          pose(p0.x, p0.y - h, 1, 1, ease(k) * 360, 0)
          break
        }
        case 'melt': { // flattens into today's tile and is gone
          const s = 1 - ease(k)
          pose(p0.x, p0.y, 1 + 0.6 * ease(k), Math.max(0.02, s), 0, 0)
          if (k > 0.9 && !act.rippled) { act.rippled = true; ring(p0); bounceDay(p0.el) }
          break
        }
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => { done = true; cancelAnimationFrame(raf); cells.forEach((c) => c.classList.remove('splash')) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="pet" ref={pet} data-moving aria-hidden>
      <i className="pet-arm" />
      <span className="pet-body">
        <i className="pet-shine" />
        <i className="pet-face" />
      </span>
    </div>
  )
}
