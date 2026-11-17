// The landing page's motion plumbing: the scroll-driven layer, in-view triggers, card loops, and the
// kit's moment and scene loaders (public/landing). Every start state is written under a class this file
// adds, so without script, under reduced motion or with the app's "reduced" setting the page stands whole.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export const reducedNow = () => document.documentElement.dataset.motion === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches
// CSS scroll-driven animations (Chrome 115+, Safari 26): the browser runs the scroll layer off the main thread
const SDA = typeof CSS !== 'undefined' && CSS.supports?.('animation-timeline: view()')
const clamp = (v) => Math.min(1, Math.max(0, v))

/*
  The page-wide scroll layer. .fx-sda: landing.css drives every entrance, depth and tilt from view() and
  scroll() timelines. .fx-io (no timeline support): an IntersectionObserver plays the same entrances once,
  and one rAF read a frame writes --prog, --hp and each visible [data-depth]'s --dp for the CSS to use.
*/
export function useScrollFx(ref) {
  useLayoutEffect(() => {
    const root = ref.current
    const hero = root.querySelector('.l-hero')
    // the nav condenses once the hero is mostly gone (both modes)
    const navIo = new IntersectionObserver(([e]) => { root.dataset.scrolled = e.intersectionRatio < 0.35 ? 'true' : 'false' }, { threshold: [0, 0.35, 1] })
    navIo.observe(hero)
    if (reducedNow()) return () => navIo.disconnect()
    root.classList.add('fx', SDA ? 'fx-sda' : 'fx-io')
    if (SDA) return () => { navIo.disconnect(); root.classList.remove('fx', 'fx-sda') }

    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return
      e.target.classList.add('is-in')
      io.unobserve(e.target)
    }), { rootMargin: '0px 0px -10% 0px' })
    root.querySelectorAll('[data-fx], .l-rise, [data-tone], .l-dg').forEach((el) => io.observe(el))

    const depth = new Set()
    const dio = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? depth.add(e.target) : depth.delete(e.target))))
    root.querySelectorAll('[data-depth]').forEach((el) => dio.observe(el))
    let raf = 0
    const tick = () => {
      raf = 0
      const vh = innerHeight, max = Math.max(1, document.documentElement.scrollHeight - vh)
      root.style.setProperty('--prog', clamp(scrollY / max).toFixed(4))
      root.style.setProperty('--hp', clamp(scrollY / vh).toFixed(4))
      depth.forEach((el) => { const r = el.getBoundingClientRect(); el.style.setProperty('--dp', clamp((vh - r.top) / (vh + r.height)).toFixed(4)) })
    }
    const req = () => { if (!raf) raf = requestAnimationFrame(tick) }
    addEventListener('scroll', req, { passive: true })
    addEventListener('resize', req)
    tick()
    return () => {
      navIo.disconnect(); io.disconnect(); dio.disconnect()
      removeEventListener('scroll', req); removeEventListener('resize', req)
      if (raf) cancelAnimationFrame(raf)
      root.classList.remove('fx', 'fx-io')
    }
  }, [])
}

// true once the element is 35% on screen; true from the start when motion is reduced or it is already on screen
export function useInView(threshold = 0.35) {
  const ref = useRef(null)
  const [inView, setIn] = useState(true)
  useLayoutEffect(() => {
    const el = ref.current
    if (reducedNow() || el.getBoundingClientRect().top < innerHeight * 0.85) return
    setIn(false)
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setIn(true); io.disconnect() } }, { threshold })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return [ref, inView]
}

// A card loop: restarts when the pointer or focus arrives (not in its first 800 ms), pauses on its disc
export function useLoop() {
  const [run, setRun] = useState(0)
  const [paused, setPaused] = useState(false)
  const started = useRef(0)
  useEffect(() => { started.current = Date.now() }, [])
  const restart = () => {
    if (paused || Date.now() - started.current < 800) return
    started.current = Date.now()
    setRun((r) => r + 1)
  }
  return { run, paused, toggle: () => setPaused((p) => !p), restart }
}

// The kit's moments (public/landing/moments): mounted on the page's own sections, torn down on unmount.
// StrictMode runs this twice on a live element: the loader keeps one mount per element, so the second
// run reuses it, and only an element that has left the page is destroyed.
export function useMoments(refs) {
  useEffect(() => {
    const els = refs.map((r) => r.current).filter(Boolean)
    window.__momentsManual = true
    let mod = null
    const p = import(/* @vite-ignore */ new URL('/landing/moments/moments.js', location.origin).href)
      .then((m) => { mod = m; return Promise.all(els.map((el) => m.mount(el).catch(() => null))) })
      .then(() => { document.documentElement.dataset.momentsReady = String(els.length) })
      .catch(() => {})
    return () => {
      // React removes the section after this: destroy only what is really leaving
      setTimeout(() => p.then(() => els.forEach((el) => { if (!el.isConnected && mod) mod.unmountAll(el.parentElement || document) })), 0)
    }
  }, [])
}

// The dealt big scene (public/landing/scenes): mounted through the kit's own loader
export function useScene(ref) {
  useEffect(() => {
    const el = ref.current
    window.__scenesManual = true
    let mod = null
    const p = import(/* @vite-ignore */ new URL('/landing/scenes/scenes.js', location.origin).href)
      .then((m) => { mod = m; return m.mount(el) })
      .then(() => { document.documentElement.dataset.scenesReady = '1' })
      .catch((e) => { el.dataset.bigSceneFailed = e.message; el.classList.add('sc', 'is-rest') })
    return () => { setTimeout(() => p.then(() => { if (!el.isConnected && mod) mod.unmountAll(el.parentElement || document) }), 0) }
  }, [])
}

// The pinned story: progress 0..1 through a sticky section, written to --p, and the step it is on
export function usePinned(steps) {
  const ref = useRef(null)
  const [live, setLive] = useState(false)
  const [step, setStep] = useState(0)
  useEffect(() => {
    const el = ref.current
    const fits = () => !reducedNow() && innerHeight >= 560
    let raf = 0, near = false
    const tick = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      const p = clamp(-r.top / Math.max(1, r.height - innerHeight))
      el.style.setProperty('--p', p.toFixed(4))
      setStep(Math.min(steps - 1, Math.floor(p * steps * 0.999 + 0.0001)))
    }
    const req = () => { if (near && !raf) raf = requestAnimationFrame(tick) }
    const io = new IntersectionObserver(([e]) => { near = e.isIntersecting; req() }, { rootMargin: '50% 0px' })
    io.observe(el)
    const sync = () => { setLive(fits()); req() }
    sync()
    addEventListener('scroll', req, { passive: true })
    addEventListener('resize', sync)
    return () => { io.disconnect(); removeEventListener('scroll', req); removeEventListener('resize', sync); if (raf) cancelAnimationFrame(raf) }
  }, [steps])
  return { ref, live, step }
}
