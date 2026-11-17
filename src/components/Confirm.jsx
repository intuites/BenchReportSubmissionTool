import { useEffect, useState } from 'react'
import Modal from './Modal'

let ask = null // set while ConfirmHost is mounted

// confirmDialog('Delete this submission?', { body, confirm: 'Delete', cancel: 'Keep' }) resolves true or false
export const confirmDialog = (title, opts = {}) =>
  new Promise((resolve) => (ask ? ask({ title, ...opts, resolve }) : resolve(window.confirm(title))))

// Mounted once in App: shows the app's own sheet instead of the browser's pop-up
export function ConfirmHost() {
  const [q, setQ] = useState(null)
  useEffect(() => { ask = setQ; return () => { ask = null } }, [])
  if (!q) return null
  const done = (answer) => { q.resolve(answer); setQ(null) }
  return (
    <Modal title={q.title} small onClose={() => done(false)}>
      <div className="form">
        {q.body && <p className="muted confirm-body">{q.body}</p>}
        <footer className="modal-foot">
          <button className="btn ghost" data-autofocus onClick={() => done(false)}>{q.cancel || 'Cancel'}</button>
          <button className="btn danger" onClick={() => done(true)}>{q.confirm || 'Delete'}</button>
        </footer>
      </div>
    </Modal>
  )
}
