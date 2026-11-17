// Vercel Cron job (weekdays, see vercel.json): one email per recruiter listing
// every assigned candidate idle for >= the admin's threshold. Uses Resend.
import { createClient } from '@supabase/supabase-js'

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const plural = (n) => `${n} day${n === 1 ? '' : 's'}`
const pause = (ms) => new Promise((r) => setTimeout(r, ms))

export default async function handler(req, res) {
  // Vercel Cron sends "Authorization: Bearer $CRON_SECRET"
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

  const { data: settings, error: sErr } = await db.from('bt_settings').select('*').eq('id', 1).single()
  if (sErr) return res.status(500).json({ error: sErr.message })
  if (!settings.followup_enabled) return res.json({ sent: 0, disabled: true })

  const { data: due, error } = await db.from('bt_followups_due').select('*')
  if (error) return res.status(500).json({ error: error.message })

  const byRecruiter = Object.groupBy(due, (f) => f.recruiter_id)
  const sent = []
  const failed = []

  for (const rows of Object.values(byRecruiter)) {
    const { recruiter_name, recruiter_email, recruiter_id } = rows[0]

    // Claim today's log rows first. If another run already claimed a
    // candidate today, the unique (candidate_id, sent_on) skips it.
    const { data: claimed, error: claimErr } = await db
      .from('bt_followup_log')
      .upsert(rows.map((f) => ({ candidate_id: f.candidate_id, recruiter_id, days_idle: f.days_idle })), { onConflict: 'candidate_id,sent_on', ignoreDuplicates: true })
      .select('id, candidate_id')
    if (claimErr) { failed.push({ recruiter: recruiter_email, error: claimErr.message }); continue }
    if (!claimed.length) continue

    const mine = rows.filter((f) => claimed.some((c) => c.candidate_id === f.candidate_id))
    const names = mine.map((f) => f.candidate_name)
    const subject = mine.length === 1
      ? `Update needed: no submissions for ${names[0]} in ${plural(mine[0].days_idle)}`
      : `Update needed: no submissions for ${mine.length} of your candidates`

    let r
    try {
    r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.FOLLOWUP_FROM_EMAIL,
        to: recruiter_email,
        subject,
        html: `<p>Hi ${esc(recruiter_name)},</p>
<p>These candidates assigned to you have had no submissions for ${plural(settings.followup_days)} or more:</p>
<ul>${mine.map((f) => `<li><strong>${esc(f.candidate_name)}</strong>${f.skill ? ` (${esc(f.skill)})` : ''}: no submissions in ${plural(f.days_idle)}</li>`).join('')}</ul>
<p>Please reply with an update: why no submissions were made, and your plan for each candidate.</p>
<p>— Bench Tracker</p>`,
      }),
    })
    } catch (e) {
      r = { ok: false, status: 'network error' } // Resend unreachable: treated like a refused send
    }

    if (r.ok) sent.push(...names)
    else {
      // Release the claim so tomorrow's run retries these candidates
      await db.from('bt_followup_log').delete().in('id', claimed.map((c) => c.id))
      failed.push({ recruiter: recruiter_email, status: r.status })
    }
    await pause(600) // stay under Resend's per-second rate limit
  }

  res.status(failed.length ? 207 : 200).json({ sent: sent.length, emails: Object.keys(byRecruiter).length, failed })
}
