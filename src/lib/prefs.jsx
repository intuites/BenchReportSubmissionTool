import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { accentTokens, PAGE } from './color'
import { supabase } from './supabase'

export { ACCENTS } from './accents'

// Interface typefaces. Each one sets the whole app; JetBrains Mono stays for code.
// `axes` is the Google Fonts request (each checked to return 200); `italic` = the family ships true italics.
// Fabric Grotesk is served from public/fonts (Befonts licence: commercial use allowed), so it has no axes.
export const FONTS = {
  host: { name: 'Host Grotesk', note: 'Quiet, exact. The default', axes: 'ital,wght@0,300..800;1,300..800', italic: true },
  fabric: { name: 'Fabric Grotesk', note: 'Tight, editorial grotesk', local: true, italic: true },
  hanken: { name: 'Hanken Grotesk', note: 'Warm, even', axes: 'ital,wght@0,100..900;1,100..900', italic: true },
  schibsted: { name: 'Schibsted Grotesk', note: 'Newsroom grotesk', axes: 'ital,wght@0,400..900;1,400..900', italic: true },
  space: { name: 'Space Grotesk', note: 'Technical, quirky', axes: 'wght@300..700' },
  familjen: { name: 'Familjen Grotesk', note: 'Friendly, rounded', axes: 'ital,wght@0,400..700;1,400..700', italic: true },
  bricolage: { name: 'Bricolage Grotesque', note: 'Characterful', axes: 'wght@200..800' },
  intertight: { name: 'Inter Tight', note: 'Neutral, compact', axes: 'ital,wght@0,100..900;1,100..900', italic: true },
  instrument: { name: 'Instrument Sans', note: 'Crisp, modern', axes: 'ital,wght@0,400..700;1,400..700', italic: true },
  geist: { name: 'Geist', note: 'Precise, developer feel', axes: 'wght@100..900' },
  onest: { name: 'Onest', note: 'Open, readable', axes: 'wght@100..900' },
  manrope: { name: 'Manrope', note: 'Geometric, friendly', axes: 'wght@200..800' },
  figtree: { name: 'Figtree', note: 'Clean, approachable', axes: 'ital,wght@0,300..900;1,300..900', italic: true },
  jakarta: { name: 'Plus Jakarta Sans', note: 'Polished, rounded', axes: 'ital,wght@0,200..800;1,200..800', italic: true },
  dmsans: { name: 'DM Sans', note: 'Low contrast, soft', axes: 'ital,wght@0,100..1000;1,100..1000', italic: true },
  archivo: { name: 'Archivo', note: 'Sturdy, wide range', axes: 'ital,wght@0,100..900;1,100..900', italic: true },
  albert: { name: 'Albert Sans', note: 'Scandinavian, airy', axes: 'ital,wght@0,100..900;1,100..900', italic: true },
  funnel: { name: 'Funnel Sans', note: 'Fresh, distinctive', axes: 'ital,wght@0,300..800;1,300..800', italic: true },
}
const MONO = { name: 'JetBrains Mono', axes: 'wght@400..500' }
// One stylesheet link for any set of Google families (local ones are skipped)
export const fontHref = (ids) => {
  const fams = [...new Set(ids)].map((id) => FONTS[id] ?? MONO).filter((f) => !f.local)
  return `https://fonts.googleapis.com/css2?${fams.map((f) => `family=${f.name.replace(/ /g, '+')}:${f.axes}`).join('&')}&display=swap`
}

// card radius; controls and buttons take two thirds of it
export const RADII = { sharp: 6, crisp: 9, soft: 12, round: 16, pill: 22 }
// interface size: the whole app scales, so tables, buttons and type stay in proportion
export const SIZES = { s: 0.92, m: 1, l: 1.08, xl: 1.16 }

export const DEFAULTS = { mode: 'system', accent: '#d0106f', fonts: 'host', radius: 'soft', size: 'm', contrast: 'normal', density: 'comfortable', motion: 'full' }

// Unknown or old choices fall back to the defaults
// (italic headings were an option once: an old saved choice is dropped, so text is never slanted)
const sanitize = ({ italic: _dropped, ...p }) => ({
  ...p,
  fonts: FONTS[p.fonts] ? p.fonts : DEFAULTS.fonts,
  radius: RADII[p.radius] ? p.radius : DEFAULTS.radius,
  size: SIZES[p.size] ? p.size : DEFAULTS.size,
  contrast: p.contrast === 'high' ? 'high' : 'normal',
})

// ---------- apply ----------
function resolveDark(mode) {
  return mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
}

function apply(p) {
  const root = document.documentElement
  const dark = resolveDark(p.mode)
  const t = accentTokens(p.accent, dark)
  const f = FONTS[p.fonts] || FONTS.host
  root.dataset.theme = dark ? 'dark' : 'light'
  root.dataset.density = p.density
  root.dataset.motion = p.motion
  root.dataset.fonts = p.fonts
  root.dataset.contrast = p.contrast
  root.style.setProperty('--accent', t.accent)
  root.style.setProperty('--accent-ink', t.ink)
  root.style.setProperty('--accent-hover', t.hover)
  root.style.setProperty('--accent-mark', t.mark)
  root.style.setProperty('--accent-soft', t.soft)
  root.style.setProperty('--on-accent', t.on)
  root.style.setProperty('--radius', `${RADII[p.radius] ?? 12}px`)
  root.style.setProperty('--ui-scale', SIZES[p.size] ?? 1)
  root.style.setProperty('--font-display', `'${f.name}', system-ui, sans-serif`)
  root.style.setProperty('--font-body', `'${f.name}', system-ui, sans-serif`)
  root.style.setProperty('--font-mono', `'${MONO.name}', ui-monospace, monospace`)
  let link = document.getElementById('font-pair')
  if (!link) { link = Object.assign(document.createElement('link'), { id: 'font-pair', rel: 'stylesheet' }); document.head.appendChild(link) }
  const href = fontHref([p.fonts, 'mono'])
  if (link.href !== href) link.href = href
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? PAGE.dark : PAGE.light)
  return { dark, ...t }
}

const KEY = 'bench-tracker-prefs'
const load = () => { try { return sanitize({ ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }) } catch { return DEFAULTS } }

const Ctx = createContext(null)

export function PrefsProvider({ children }) {
  const [prefs, setPrefs] = useState(load)
  const [resolved, setResolved] = useState(() => apply(prefs))
  // Signed in, choices are saved to the account (bt_user_prefs) so they follow the person;
  // localStorage stays as the first-paint cache. Without a saved choice, the team default applies.
  const [userId, setUserId] = useState(null)
  const [team, setTeam] = useState(null)
  const [sync, setSync] = useState('local') // local | loading | saved | saving | error
  const ready = useRef(false)

  useEffect(() => {
    ready.current = false
    if (!userId || !supabase) { setSync('local'); return }
    let live = true
    setSync('loading')
    Promise.all([
      supabase.from('bt_user_prefs').select('prefs').eq('user_id', userId).limit(1),
      supabase.from('bt_settings').select('team_prefs').eq('id', 1).limit(1),
    ]).then(([own, t]) => {
      if (!live) return
      const teamPrefs = t.data?.[0]?.team_prefs ?? null // a waiting account can't read settings: no team default
      setTeam(teamPrefs && Object.keys(teamPrefs).length ? teamPrefs : null)
      if (own.error) { setSync('error'); return } // table not created yet: keep this device's choices
      const mine = own.data?.[0]?.prefs
      if (mine && Object.keys(mine).length) setPrefs(sanitize({ ...DEFAULTS, ...mine }))
      else if (teamPrefs && Object.keys(teamPrefs).length) setPrefs(sanitize({ ...DEFAULTS, ...teamPrefs }))
      ready.current = true
      setSync('saved')
    })
    return () => { live = false }
  }, [userId])

  // Save to the account half a second after the last change
  useEffect(() => {
    if (!ready.current || !userId) return
    setSync('saving')
    const t = setTimeout(async () => {
      const { error } = await supabase.from('bt_user_prefs').upsert({ user_id: userId, prefs, updated_at: new Date().toISOString() })
      setSync(error ? 'error' : 'saved')
    }, 500)
    return () => clearTimeout(t)
  }, [prefs, userId])

  useEffect(() => {
    setResolved(apply(prefs))
    try { localStorage.setItem(KEY, JSON.stringify(prefs)) } catch { /* private mode: prefs just don't persist */ }
    if (prefs.mode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => setResolved(apply(prefs))
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [prefs])

  const value = useMemo(() => {
    const reduced = prefs.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    return {
      prefs,
      resolved,
      reduced,
      sync,
      team,
      setUser: setUserId,
      set: (patch) => setPrefs((p) => ({ ...p, ...patch })),
      // back to the team's default look when an admin has set one, else the app's
      reset: () => setPrefs(sanitize({ ...DEFAULTS, ...(team ?? {}) })),
      // admins: make the current look the team default (an empty object clears it)
      async setTeamDefault(p) {
        const { error } = await supabase.from('bt_settings').update({ team_prefs: p }).eq('id', 1)
        if (error) throw error
        setTeam(Object.keys(p).length ? p : null)
      },
      // Like set, but the new look opens as a circle from where you clicked
      reveal(patch, event) {
        const next = { ...prefs, ...patch }
        const swap = () => flushSync(() => { setPrefs(next); setResolved(apply(next)) })
        if (!document.startViewTransition || reduced) return swap()
        const x = event?.clientX ?? window.innerWidth / 2
        const y = event?.clientY ?? window.innerHeight / 2
        const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
        const root = document.documentElement
        root.dataset.vt = 'theme'
        const t = document.startViewTransition(swap)
        t.ready
          .then(() => root.animate(
            { clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
            { duration: 700, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' },
          ))
          .catch(() => {})
        t.finished.finally(() => { delete root.dataset.vt })
      },
    }
  }, [prefs, resolved, sync, team])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const usePrefs = () => useContext(Ctx)
