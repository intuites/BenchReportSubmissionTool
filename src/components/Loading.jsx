import { Logo } from './Logo'

// Shimmering placeholder rows shaped like the table that is loading
const WIDTHS = [72, 54, 86, 64, 48, 78, 58]
export function SkeletonRows({ cols, rows = 5 }) {
  return Array.from({ length: rows }, (_, r) => (
    <tr key={r} className="sk-row" aria-hidden>
      {Array.from({ length: cols }, (_, c) => (
        <td key={c}><span className="sk" style={{ width: `${WIDTHS[(r + c * 3) % WIDTHS.length]}%`, animationDelay: `${r * 70}ms` }} /></td>
      ))}
    </tr>
  ))
}

// A placeholder line, for lists and cards that are not tables
export const SkeletonLine = ({ width = '60%', height = 14 }) => <span className="sk" style={{ width, height }} aria-hidden />

// First paint while the session and team membership are checked
export function Splash() {
  return (
    <main className="splash" aria-busy="true" aria-label="Loading Bench Tracker">
      <Logo />
      <span className="splash-bar" aria-hidden><i /></span>
    </main>
  )
}
