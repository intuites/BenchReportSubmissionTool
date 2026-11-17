import { useRef } from 'react'
import { Liquid, useActiveRect } from './Liquid'

// items: [[id, label], ...]
export default function Segmented({ items, value, onChange, label }) {
  const ref = useRef(null)
  const rect = useActiveRect(ref, value)
  return (
    <div className="segmented" role="group" aria-label={label} ref={ref}>
      <Liquid rect={rect} tone="surface" />
      {items.map(([id, text]) => (
        <button key={id} type="button" aria-pressed={value === id} data-active={value === id} className={value === id ? 'on' : ''} onClick={(e) => onChange(id, e)}>
          {text}
        </button>
      ))}
    </div>
  )
}
