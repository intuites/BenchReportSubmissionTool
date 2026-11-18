import { Fragment, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Select from './Select'
import DateField from './DateField'
import { saveErrorMessage } from '../lib/dbError'
import { useLive } from '../lib/live'

// Field config:
// { name, label, type: 'text'|'email'|'date'|'number'|'textarea'|'select'|'checkbox',
//   required, options: ['A','B'] | ref: { table, select, label: row => string }, filterBy: 'company_id',
//   section: 'Vendor' (starts a named group above this field) }
export default function RecordForm({ fields, initial = {}, onSubmit, onCancel, submitLabel = 'Save' }) {
  const [form, setForm] = useState(() => Object.fromEntries(fields.map((f) => [f.name, initial[f.name] ?? f.default ?? (f.type === 'checkbox' ? true : '')])))
  const [refs, setRefs] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadRefs = () =>
    fields.filter((f) => f.ref).forEach(async (f) => {
      const cols = f.ref.select || 'id, name'
      const { data, error } = await supabase.from(f.ref.table).select(cols).order(f.ref.order || 'name', { ascending: !f.ref.desc }).limit(f.ref.limit || 1000)
      if (error) return setError(error.message)
      // An edited record's current value may fall outside a capped list: fetch it too
      const current = initial[f.name]
      if (current && !data.some((o) => o.id === current)) {
        const { data: one } = await supabase.from(f.ref.table).select(cols).eq('id', current).maybeSingle()
        if (one) data.unshift(one)
      }
      setRefs((r) => ({ ...r, [f.name]: data }))
      // A recruiter can only see themselves, so their own name is the one answer: fill it in
      if (f.ref.table === 'bt_recruiters' && data.length === 1) setForm((prev) => (prev[f.name] ? prev : { ...prev, [f.name]: data[0].id }))
    })
  // fields is static per page
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadRefs() }, [])
  // a candidate, company or contact added elsewhere appears in the lists at once; the values already
  // typed or picked in this form stay exactly as they are
  useLive([...new Set(fields.filter((f) => f.ref).map((f) => f.ref.table))], loadRefs)

  // Until every dropdown list has arrived its select has no matching option, so the browser
  // would reject Save with "select an item" on a field that is really filled
  const listsReady = fields.every((f) => !f.ref || refs[f.name])

  const set = (name, value) =>
    setForm((prev) => {
      const next = { ...prev, [name]: value }
      // clear dependent selects whose parent changed
      fields.filter((f) => f.filterBy === name).forEach((f) => (next[f.name] = ''))
      return next
    })

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || null : v]))
    try {
      await onSubmit(payload)
    } catch (err) {
      setError(saveErrorMessage(err, fields, payload))
      setSaving(false)
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="form-grid">
        {fields.map((f) => {
          const id = `f-${f.name}`
          const common = { id, required: f.required, value: form[f.name] ?? '', onChange: (e) => set(f.name, e.target.value) }
          let control
          if (f.type === 'select') {
            let opts = f.options ? f.options.map((o) => ({ id: o, label: o })) : (refs[f.name] || []).map((r) => ({ ...r, label: f.ref.label ? f.ref.label(r) : r.name }))
            // keep the current choice even if it no longer matches (e.g. candidate reassigned since)
            if (f.filterBy && form[f.filterBy]) opts = opts.filter((o) => o[f.filterBy] === form[f.filterBy] || o.id === form[f.name])
            control = (
              <Select {...common}>
                <option value="">{f.filterBy && !form[f.filterBy] && f.filterRequired ? `Pick ${f.filterLabel} first` : 'Select…'}</option>
                {opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </Select>
            )
          } else if (f.type === 'textarea') control = <textarea rows={3} {...common} />
          else if (f.type === 'checkbox')
            control = <label className="check"><input id={id} type="checkbox" checked={!!form[f.name]} onChange={(e) => set(f.name, e.target.checked)} /> {f.checkLabel || 'Yes'}</label>
          else if (f.type === 'date') control = <DateField {...common} />
          else control = <input type={f.type || 'text'} placeholder={f.placeholder} {...common} />
          return (
            <Fragment key={f.name}>
              {f.section && <p className="form-section">{f.section}</p>}
              <div className={`field ${f.wide || f.type === 'textarea' ? 'wide' : ''}`}>
                <label htmlFor={id}>{f.label}{f.required && <span className="req">*</span>}</label>
                {control}
              </div>
            </Fragment>
          )
        })}
      </div>
      {error && <p className="alert" role="alert">{error}</p>}
      <footer className="modal-foot">
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
        <button className="btn primary" disabled={saving || !listsReady} aria-busy={saving || !listsReady}>{saving ? 'Saving…' : listsReady ? submitLabel : 'Loading…'}</button>
      </footer>
    </form>
  )
}
