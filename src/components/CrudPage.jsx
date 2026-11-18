import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { WORK, useLive } from '../lib/live'
import { confirmDialog } from './Confirm'
import Modal from './Modal'
import PageHead from './PageHead'
import RecordForm from './RecordForm'
import { SkeletonRows } from './Loading'

const PAGE = 200

// Text a person can see: drops ids, foreign keys and true/false flags
const searchText = (row) =>
  JSON.stringify(row, (k, v) => (k === 'id' || k.endsWith('_id') || typeof v === 'boolean' ? undefined : v)).toLowerCase()

// One list page for any table: search, add, edit, delete.
export default function CrudPage({ title, subtitle, table, select = '*', order = 'created_at', ascending = false, columns, fields, rowActions, addLabel = 'Add', noun = 'record', reloadKey, toolbar, before, readOnly = false }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // {} = new, row = edit. The dashboard's "Log submission" asks this page to open its form on arrival.
  // Read here, cleared in an effect: React's dev mode runs this initializer twice, and clearing
  // inside it left the second run empty so the form never opened.
  const [editing, setEditing] = useState(() => {
    if (sessionStorage.getItem('bt-open-new') !== table) return null
    // optional starting values, e.g. the candidate and recruiter from a dashboard row
    try { return JSON.parse(sessionStorage.getItem('bt-prefill') || '{}') } catch { return {} }
  })
  useEffect(() => {
    if (sessionStorage.getItem('bt-open-new') !== table) return
    sessionStorage.removeItem('bt-open-new')
    sessionStorage.removeItem('bt-prefill')
  }, [table])
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(PAGE)

  // Paged: the API caps a response at 1,000 rows, so never ask for "everything"
  // quiet: a live update, so no loading state and nothing cleared (an open form, the search, the scroll stay)
  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    const { data, error } = await supabase.from(table).select(select).order(order, { ascending }).order('id').range(0, limit - 1)
    setLoading(false)
    if (error) { if (!quiet) setError(error.message) }
    else { setError(''); setRows(data) }
  }, [table, select, order, ascending, limit])

  useEffect(() => { load() }, [load, reloadKey])
  // someone else (or another tab) adds, edits or removes a record: the list updates in place
  useLive(WORK, () => load(true))

  async function save(payload) {
    const query = editing.id ? supabase.from(table).update(payload).eq('id', editing.id) : supabase.from(table).insert(payload)
    const { error } = await query
    if (error) throw error
    setEditing(null)
    load()
  }

  async function remove(row) {
    if (!(await confirmDialog(`Delete this ${noun}?`, { body: 'This cannot be undone.', confirm: `Delete ${noun}`, cancel: 'Keep' }))) return
    const { error } = await supabase.from(table).delete().eq('id', row.id)
    if (error) setError(error.code === '23503' ? `This ${noun} has submissions linked to it, so it can't be deleted. Mark it inactive instead.` : error.message)
    else load()
  }

  const needle = q.trim().toLowerCase()
  const shown = needle ? rows.filter((r) => searchText(r).includes(needle)) : rows
  const hasMore = rows.length === limit

  return (
    <section className="page">
      <PageHead title={title} subtitle={subtitle}>
        {toolbar}
        <label className="search">
          <Search size={16} aria-hidden />
          <input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Search ${title}`} />
        </label>
        {!readOnly && <button className="btn primary" onClick={() => setEditing({})}><Plus size={16} /> {addLabel}</button>}
      </PageHead>

      {before}
      {error && <p className="alert" role="alert">{error}</p>}

      <div className={`card table-wrap ${loading && rows.length ? 'is-loading' : ''}`} aria-busy={loading}>
        <table className="table stackable">
          <thead>
            <tr>
              {columns.map((c) => <th key={c.label} className={c.num ? 'num' : ''}>{c.label}</th>)}
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {loading && !rows.length && <SkeletonRows cols={columns.length + 1} />}
            {!loading && shown.length === 0 && (
              <tr><td colSpan={columns.length + 1} className="empty">{q ? 'Nothing matches your search' : `No ${noun}s yet. Add the first one`}</td></tr>
            )}
            {!(loading && !rows.length) && shown.map((row) => (
              <tr key={row.id}>
                {columns.map((c) => <td key={c.label} data-label={c.label} className={c.num ? 'num' : ''}>{c.render ? c.render(row) : row[c.key] ?? '—'}</td>)}
                <td className="row-actions">
                  {rowActions?.(row)}
                  {!readOnly && <>
                  <button className="icon-btn" onClick={() => setEditing(row)} aria-label={`Edit ${noun}`}><Pencil size={15} /></button>
                  <button className="icon-btn danger" onClick={() => remove(row)} aria-label={`Delete ${noun}`}><Trash2 size={15} /></button></>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {hasMore && (
          <div className="load-more">
            <span className="muted small">Showing the latest {rows.length}{needle ? ' (search covers these)' : ''}</span>
            <button className="btn small" onClick={() => setLimit((n) => n + PAGE)} disabled={loading}>Load more</button>
          </div>
        )}
      </div>

      {editing && (
        <Modal title={editing.id ? `Edit ${noun}` : addLabel} onClose={() => setEditing(null)}>
          <RecordForm fields={fields} initial={editing} onSubmit={save} onCancel={() => setEditing(null)} />
        </Modal>
      )}
    </section>
  )
}
