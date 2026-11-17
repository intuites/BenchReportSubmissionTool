import { useEffect, useMemo, useState } from 'react'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { fmtDate, iso, today } from '../lib/period'
import { usePrefs } from '../lib/prefs'
import PageHead from '../components/PageHead'
import Segmented from '../components/Segmented'
import DateField from '../components/DateField'
import MenuButton from '../components/MenuButton'
import Modal from '../components/Modal'
import { SkeletonRows } from '../components/Loading'
import { Count } from '../stageshow/kit/motion/Count'

const PRESETS = [['month', 'This month'], ['last', 'Last month'], ['quarter', 'This quarter'], ['year', 'This year'], ['custom', 'Custom']]
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)
const KEYS = ['candidates', 'idle_candidates', 'submissions', 'interviews', 'selected', 'rejected']

function rangeFor(id) {
  const now = new Date(`${today()}T00:00:00`), y = now.getFullYear(), m = now.getMonth()
  if (id === 'last') return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) }
  if (id === 'quarter') { const q = Math.floor(m / 3) * 3; return { from: iso(new Date(y, q, 1)), to: today() } }
  if (id === 'year') return { from: iso(new Date(y, 0, 1)), to: today() }
  return { from: iso(new Date(y, m, 1)), to: today() }
}

// Admin-only: every recruiter's performance for a period, with PDF and Excel export.
// The database refuses this report to anyone who is not an admin (bt_team_report).
export default function Reports({ admin }) {
  const { resolved } = usePrefs()
  const [preset, setPreset] = useState('month')
  const [custom, setCustom] = useState(rangeFor('month'))
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [preview, setPreview] = useState(null) // { kind, report, url?, doc?, rows? }
  const { from, to } = preset === 'custom' ? custom : rangeFor(preset)
  const valid = from && to && from <= to

  useEffect(() => {
    if (!admin || !valid) return
    let live = true
    setRows(null)
    supabase.rpc('bt_team_report', { p_from: from, p_to: to }).then(({ data, error: e }) => {
      if (!live) return
      if (e) return setError(e.message.includes('bt_team_report') ? 'The database is missing the team report. Run supabase/schema.sql again in the Supabase SQL Editor.' : e.message)
      setError(''); setRows(data)
    })
    return () => { live = false }
  }, [admin, from, to, valid])

  const totals = useMemo(() => Object.fromEntries(KEYS.map((k) => [k, (rows ?? []).reduce((n, r) => n + r[k], 0)])), [rows])
  const best = rows?.length ? Math.max(1, ...rows.map((r) => r.interviews)) : 1
  const label = `${fmtDate(from)} – ${fmtDate(to)}`

  // Export: build the file, show it, and download only after a look
  async function openPreview(kind) {
    setBusy(kind); setError('')
    try {
      const m = await import('../lib/exportReport')
      const report = { from, to, label, rows, totals, accent: resolved.accent, on: resolved.on, generated: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) }
      if (kind === 'pdf') {
        const doc = await m.pdfDoc(report)
        setPreview({ kind, report, doc, url: URL.createObjectURL(doc.output('blob')) })
      } else setPreview({ kind, report, rows: m.sheetData(report), cols: m.COLUMNS.length })
    } catch (e) {
      setError(`Could not prepare the ${kind === 'pdf' ? 'PDF' : 'Excel file'}: ${e.message}`)
    }
    setBusy('')
  }
  async function download() {
    setBusy('download')
    try {
      const m = await import('../lib/exportReport')
      if (preview.kind === 'pdf') m.savePdf(preview.doc, preview.report)
      else await m.exportExcel(preview.report)
      closePreview()
    } catch (e) {
      setError(`Download failed: ${e.message}`)
    }
    setBusy('')
  }
  function closePreview() {
    if (preview?.url) URL.revokeObjectURL(preview.url)
    setPreview(null)
  }

  if (!admin) {
    return (
      <section className="page">
        <PageHead title="Reports" subtitle="Team performance reports" />
        <p className="empty-line">Reports are for admins. Ask an admin if you need one</p>
      </section>
    )
  }

  return (
    <section className="page">
      <PageHead title="Reports" subtitle={`Team performance · ${label}`}>
        <MenuButton
          label={busy ? 'Exporting…' : 'Export'}
          icon={Download}
          primary
          disabled={!rows?.length || !!busy}
          busy={!!busy}
          onPick={openPreview}
          items={[
            { id: 'pdf', label: 'PDF', note: 'A printable report', icon: FileText },
            { id: 'xlsx', label: 'Excel', note: 'A spreadsheet (.xlsx)', icon: FileSpreadsheet },
          ]}
        />
      </PageHead>

      <div className="report-bar">
        <Segmented label="Report period" items={PRESETS} value={preset} onChange={(p) => { setPreset(p); if (p === 'custom') setCustom({ from, to }) }} />
        {preset === 'custom' && (
          <div className="report-dates">
            <label>From <DateField value={custom.from} max={custom.to} required range={custom} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} /></label>
            <label>To <DateField value={custom.to} min={custom.from} required range={custom} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} /></label>
          </div>
        )}
      </div>

      {error && <p className="alert" role="alert">{error}</p>}
      {!valid && <p className="alert" role="alert">Pick a start date on or before the end date</p>}

      <div className="card figures report-figures">
        <Figure label="Submissions" value={rows && totals.submissions} note={rows && <span><b>{rows.length}</b> recruiters</span>} />
        <Figure label="Interviews" accent value={rows && totals.interviews} note={rows && <span><b>{pct(totals.interviews, totals.submissions)}%</b> hit rate</span>} />
        <Figure label="Selected" good={totals.selected > 0} value={rows && totals.selected} note={rows && <span><b>{pct(totals.selected, totals.interviews)}%</b> of interviews</span>} />
        <Figure label="Idle candidates" value={rows && totals.idle_candidates} note={rows && <span>of <b>{totals.candidates}</b> on the bench</span>} />
      </div>

      <div className="card">
        <header className="card-head"><h2>By recruiter</h2><span className="muted small">Ranked by interviews</span></header>
        <table className="table stackable report-table">
          <thead>
            <tr><th>Recruiter</th><th className="num">Candidates</th><th className="num">Idle</th><th className="num">Submissions</th><th>Interviews</th><th className="num">Hit rate</th><th className="num">Selected</th><th className="num">Rejected</th></tr>
          </thead>
          <tbody>
            {!rows && <SkeletonRows cols={8} rows={4} />}
            {rows?.length === 0 && <tr><td colSpan={8} className="empty">No recruiters or activity in this period</td></tr>}
            {rows?.map((r) => (
              <tr key={r.recruiter_id} className={r.active ? '' : 'inactive'}>
                <td data-label="Recruiter"><a className="row-link" href={`#recruiters/${r.recruiter_id}`}><strong>{r.recruiter_name}</strong><span className="sub">{r.active ? r.recruiter_email : 'Inactive'}</span></a></td>
                <td data-label="Candidates" className="num">{r.candidates}</td>
                <td data-label="Idle" className="num">{r.idle_candidates ? <span className="idle-days">{r.idle_candidates}</span> : 0}</td>
                <td data-label="Submissions" className="num">{r.submissions}</td>
                <td data-label="Interviews"><div className="meter"><i><span style={{ width: `${(r.interviews / best) * 100}%` }} /></i><b>{r.interviews}</b></div></td>
                <td data-label="Hit rate" className="num">{r.submissions ? `${pct(r.interviews, r.submissions)}%` : '—'}</td>
                <td data-label="Selected" className="num">{r.selected}</td>
                <td data-label="Rejected" className="num">{r.rejected}</td>
              </tr>
            ))}
          </tbody>
          {rows?.length > 0 && (
            <tfoot>
              <tr>
                <td data-label="Team"><strong>Team total</strong></td>
                <td data-label="Candidates" className="num">{totals.candidates}</td>
                <td data-label="Idle" className="num">{totals.idle_candidates}</td>
                <td data-label="Submissions" className="num">{totals.submissions}</td>
                <td data-label="Interviews"><b>{totals.interviews}</b></td>
                <td data-label="Hit rate" className="num">{pct(totals.interviews, totals.submissions)}%</td>
                <td data-label="Selected" className="num">{totals.selected}</td>
                <td data-label="Rejected" className="num">{totals.rejected}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {preview && (
        <Modal title={preview.kind === 'pdf' ? 'Preview: PDF report' : 'Preview: Excel spreadsheet'} onClose={closePreview} wide>
          <div className="export-preview">
            {preview.kind === 'pdf'
              ? <iframe className="pdf-frame" src={`${preview.url}#toolbar=0&navpanes=0&view=FitH`} title="PDF preview" />
              : <SheetPreview rows={preview.rows} cols={preview.cols} />}
          </div>
          <footer className="modal-foot">
            <span className="muted small foot-note">{preview.kind === 'pdf' ? 'This is the exact file you will download' : 'Sheet "Team report" · rates are real percentages in Excel'}</span>
            <button type="button" className="btn ghost" onClick={closePreview}>Cancel</button>
            <button type="button" className="btn primary" data-autofocus disabled={busy === 'download'} aria-busy={busy === 'download'} onClick={download}>
              <Download size={16} /> Download {preview.kind === 'pdf' ? 'PDF' : 'Excel'}
            </button>
          </footer>
        </Modal>
      )}
    </section>
  )
}

// The spreadsheet drawn as Excel shows it: column letters, row numbers, the same cells
function SheetPreview({ rows, cols }) {
  const shown = (c) => (c == null ? '' : typeof c !== 'object' ? String(c) : c.format === '0%' ? `${Math.round(c.value * 100)}%` : String(c.value ?? ''))
  return (
    <div className="sheet" role="table" aria-label="Spreadsheet preview">
      <div className="sheet-row sheet-head" role="row">
        <span className="sheet-num" aria-hidden />
        {Array.from({ length: cols }, (_, i) => <span key={i} role="columnheader">{String.fromCharCode(65 + i)}</span>)}
      </div>
      {rows.map((row, r) => (
        <div key={r} className="sheet-row" role="row">
          <span className="sheet-num" aria-hidden>{r + 1}</span>
          {row.length === 1 ? (
            // a title row: like Excel, the text runs across the empty cells beside it
            <span role="cell" className={typeof row[0] === 'object' && row[0]?.fontWeight === 'bold' ? 'b span' : 'span'} style={{ gridColumn: `2 / span ${cols}` }}>{shown(row[0])}</span>
          ) : Array.from({ length: cols }, (_, i) => {
            const c = row[i]
            const bold = c && typeof c === 'object' && c.fontWeight === 'bold'
            const num = c != null && (typeof c === 'number' || (typeof c === 'object' && typeof c.value === 'number'))
            return <span key={i} role="cell" className={`${bold ? 'b' : ''} ${num ? 'n' : ''} ${c?.backgroundColor ? 'h' : ''}`}>{shown(c)}</span>
          })}
        </div>
      ))}
    </div>
  )
}

function Figure({ label, value, note, accent, good }) {
  return (
    <div className={`figure ${accent ? 'accent' : ''} ${good ? 'good' : ''}`}>
      <span>{label}</span>
      <strong>{value == null ? <span className="skeleton" /> : <Count value={value} duration={900} />}</strong>
      <small>{note || ' '}</small>
    </div>
  )
}
