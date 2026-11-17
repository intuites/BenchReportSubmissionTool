import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { usePrefs } from '../lib/prefs'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'

export default function Modal({ title, onClose, small, wide, children }) {
  const ref = useRef(null)
  const [closing, setClosing] = useState(false)
  const { reduced } = usePrefs()
  // play the exit animation, then unmount
  const close = () => { if (reduced) return onClose(); setClosing(true); setTimeout(onClose, 190) }

  useEffect(() => {
    const prev = document.activeElement
    const box = ref.current
    ;(box?.querySelector('[data-autofocus]') || box?.querySelector('input, select, textarea') || box?.querySelector('button'))?.focus()
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = ''; prev?.focus?.() }
  }, [])

  function onKeyDown(e) {
    if (e.key === 'Escape') return close()
    if (e.key !== 'Tab') return
    // keep Tab inside the sheet
    const items = [...ref.current.querySelectorAll(FOCUSABLE)]
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }

  return (
    <div className={`overlay ${closing ? 'closing' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className={`modal ${small ? 'small' : ''} ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref} onKeyDown={onKeyDown}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={close} aria-label="Close"><X size={18} /></button>
        </header>
        {children}
      </div>
    </div>
  )
}
