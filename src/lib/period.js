// Local-date helpers (YYYY-MM-DD) for daily / weekly / monthly reports.
export const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const today = () => iso(new Date())

// Weeks run Monday to Sunday.
export function periodRange(period, anchor) {
  const d = new Date(`${anchor}T00:00:00`)
  if (period === 'day') return { from: iso(d), to: iso(d) }
  if (period === 'week') {
    const start = new Date(d)
    start.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { from: iso(start), to: iso(end) }
  }
  return { from: iso(new Date(d.getFullYear(), d.getMonth(), 1)), to: iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)) }
}

export function shift(period, anchor, dir) {
  const d = new Date(`${anchor}T00:00:00`)
  if (period === 'day') d.setDate(d.getDate() + dir)
  else if (period === 'week') d.setDate(d.getDate() + 7 * dir)
  else d.setMonth(d.getMonth() + dir, 1)
  return iso(d)
}

export const fmtDate = (s) =>
  s ? new Date(`${s}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
