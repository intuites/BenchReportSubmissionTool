# Bench Tracker

Tracks bench sales submissions, the interviews they produce, and assigned candidates going without submissions. React (Vite, JavaScript) + Supabase, hosted on Vercel.

## Setup

1. **Database**: create a Supabase project, open SQL Editor, paste and run [supabase/schema.sql](supabase/schema.sql).
2. **Make yourself admin**: in the SQL Editor run `insert into bt_admins (email) values ('you@yourcompany.com');` (lowercase).
3. **Sign-up**: leave "Allow new users to sign up" and "Confirm email" **on** (Supabase → Authentication → Sign In / Providers). Anyone can create an account on the sign-in page, but an account sees data only after its email is confirmed **and** it is an active recruiter (Recruiters page) or listed in `bt_admins`. Everyone else sees "Waiting for access". In Authentication → URL Configuration, set the Site URL to your app's address so confirmation links land back on it.
4. **Check it**: run [supabase/test.sql](supabase/test.sql) in the SQL Editor. It should say `All bt tests passed` and leaves no data behind.
5. **Env**: copy `.env.example` to `.env`, fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
6. `npm install` then `npm run dev`.

## Follow-up emails (on Vercel)

`api/send-followups.js` runs daily on weekdays at 14:00 UTC (`vercel.json`). It reads the `bt_followups_due` view and sends **one email per recruiter** listing their idle candidates through [Resend](https://resend.com). Each candidate is claimed in `bt_followup_log` before sending (one row per candidate per day), so a repeated run never double-emails, and a failed send is released to retry next run. In Vercel, set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `FOLLOWUP_FROM_EMAIL`, `CRON_SECRET`, plus the two `VITE_` vars.

## Tables

| Table | Holds |
|---|---|
| `bt_recruiters` | internal bench sales recruiters |
| `bt_candidates` | bench consultants, `recruiter_id` = assigned recruiter |
| `bt_companies` | one row per vendor company (e.g. Cognizant) |
| `bt_vendor_contacts` | external recruiters (name, email), linked to a company |
| `bt_submissions` | date, recruiter, candidate, rate, company, vendor contact |
| `bt_interviews` | linked to one exact submission |
| `bt_settings` | single row: follow-up threshold in days, on/off |
| `bt_followup_log` | emails sent |

Reports: `bt_recruiter_activity(from, to)` and `bt_missed_submissions(from, to)` functions, and the `bt_followups_due` view.

`src/stageshow/` holds the animated login-page demo, built with the parts of the Stageshow kit (MIT) it uses. It loads only on the sign-in screen.
