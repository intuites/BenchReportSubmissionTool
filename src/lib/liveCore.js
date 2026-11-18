// The live channel itself, apart from React and the real client, so it can be tested with a fake one
// (live.test.js). See live.js.
export const TABLES = ['bt_submissions', 'bt_interviews', 'bt_candidates', 'bt_recruiters', 'bt_companies', 'bt_vendor_contacts', 'bt_settings', 'bt_followup_log', 'bt_admins', 'bt_blocked']
export const WORK = ['bt_submissions', 'bt_interviews', 'bt_candidates', 'bt_recruiters', 'bt_companies', 'bt_vendor_contacts']

export function createLive(client) {
  const listeners = new Set()
  let channel = null
  const ensure = () => {
    if (channel || !client) return
    channel = client.channel('bt-live')
    for (const table of TABLES) channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => listeners.forEach((l) => l(table)))
    channel.subscribe()
  }
  // calls fn (once, `wait` ms after the last of a burst) whenever one of `tables` changes
  const onLive = (tables, fn, { wait = 400 } = {}) => {
    ensure()
    let timer = 0
    const hear = (table) => {
      if (!tables.includes(table)) return
      clearTimeout(timer)
      timer = setTimeout(fn, wait)
    }
    listeners.add(hear)
    return () => { clearTimeout(timer); listeners.delete(hear) }
  }
  return { onLive, size: () => listeners.size }
}

