import { useEffect, useRef } from 'react'
import { supabase } from './supabase'
import { createLive } from './liveCore.js'

// Live data: one Supabase Realtime channel for the whole app hears every change to the working tables
// (row security still decides who hears what), and each open page that cares reloads its own data,
// quietly: no loading state, nothing cleared, so a form someone is filling in, a search, a scroll
// position all stay as they are. A burst of changes (an import, a bulk edit) reloads once, after it
// settles. Coming back to the tab reloads too, in case the connection slept.
// The tables must be in the supabase_realtime publication (supabase/schema.sql does that).
export { TABLES, WORK } from './liveCore.js'

const live = createLive(supabase)
export const onLive = live.onLive

// In a component: run fn whenever one of `tables` changes, or the tab comes back into view.
// fn always sees the component's latest state (it is kept in a ref), so it never reloads stale filters.
export function useLive(tables, fn) {
  const latest = useRef(fn)
  latest.current = fn
  const key = tables.join()
  useEffect(() => {
    const off = onLive(tables, () => latest.current())
    const back = () => { if (document.visibilityState === 'visible') latest.current() }
    document.addEventListener('visibilitychange', back)
    return () => { off(); document.removeEventListener('visibilitychange', back) }
    // tables is compared by its joined names
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}
