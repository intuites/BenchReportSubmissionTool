// sRGB color math for user-picked accents.
export const hex = (h) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(h) || /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(h)
  if (!m) return [15, 118, 110]
  const s = m.length === 2 ? m[1] : m.slice(1).map((c) => c + c).join('')
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16))
}
export const toHex = (rgb) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)
export const luminance = (rgb) => {
  const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

// The grounds an accent sits on (styles.css: --bg, --surface, --alt), per mode
export const PAGE = { light: '#f7f7f5', dark: '#141413' }
export const GROUNDS = { light: ['#f7f7f5', '#ffffff', '#ebebe8'], dark: ['#141413', '#1b1b1a', '#1f1f1d'] }
const WHITE = [255, 255, 255], INK = [17, 17, 17]
const worst = (c, grounds) => Math.min(...grounds.map((g) => contrast(c, g)))
// move c toward `to` in small steps until test(c) passes (at most all the way).
// The tests ask slightly above each line so rounding to a hex code can't drop below it.
const nudge = (c, to, test) => { let x = c; for (let i = 1; i <= 25 && !test(x); i++) x = mix(c, to, i * 0.04); return x }

// Every job the accent does gets its own shade, each checked against what it sits on:
//   accent  button fills: label `on` reads at 4.5:1
//   hover   the fill on hover: still 4.5:1, moved away from the label colour
//   mark    outlines, chart bars, icons, the current-page bar: 3:1 on every ground
//   soft    the tinted background of soft pills and highlights (solid colour)
//   ink     accent text and links: 4.5:1 on every ground and on `soft`
export function accentTokens(input, dark) {
  const mode = dark ? 'dark' : 'light'
  const grounds = GROUNDS[mode].map(hex)
  const base = hex(input)
  // the label goes where it reads best, then the fill is nudged until it reads at 4.5:1
  const on = contrast(base, WHITE) >= contrast(base, INK) ? WHITE : INK
  const away = on === WHITE ? [0, 0, 0] : WHITE
  const accent = nudge(base, away, (c) => contrast(c, on) >= 4.6)
  let hover = nudge(mix(accent, away, 0.12), away, (c) => contrast(c, on) >= 4.6)
  // already at white or black: step toward the label instead, as far as the label still reads
  if (toHex(hover) === toHex(accent)) hover = [0.1, 0.07, 0.04].map((t) => mix(accent, on, t)).find((c) => contrast(c, on) >= 4.5) ?? accent
  const toward = dark ? WHITE : [0, 0, 0]
  const mark = nudge(base, toward, (c) => worst(c, grounds) >= 3.1)
  const soft = mix(grounds[1], base, dark ? 0.24 : 0.12)
  const ink = nudge(base, toward, (c) => worst(c, grounds) >= 4.6 && contrast(c, soft) >= 4.6)
  return { accent: toHex(accent), hover: toHex(hover), on: toHex(on), mark: toHex(mark), soft: toHex(soft), ink: toHex(ink) }
}
