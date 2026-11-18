-- =====================================================================
-- Bench Sales Submission Tracker — full schema
-- Run once in Supabase: SQL Editor > New query > paste > Run.
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE where possible.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. Internal bench sales recruiters
-- ---------------------------------------------------------------------
create table if not exists bt_recruiters (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null unique,
  phone       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table bt_recruiters enable row level security;

-- ---------------------------------------------------------------------
-- 2. Bench candidates, each assigned to one recruiter
-- ---------------------------------------------------------------------
create table if not exists bt_candidates (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         text,
  phone         text,
  skill         text,                      -- e.g. "Java Full Stack", "Data Engineer"
  visa_status   text,                      -- e.g. H1B, GC, USC, OPT
  recruiter_id  uuid references bt_recruiters(id) on delete set null,
  assigned_at   timestamptz not null default now(),  -- reset when recruiter changes
  active        boolean not null default true,       -- false = placed / off bench
  created_at    timestamptz not null default now()
);
alter table bt_candidates enable row level security;
create index if not exists bt_candidates_recruiter_idx on bt_candidates(recruiter_id);

-- Reset assigned_at whenever a candidate moves to a different recruiter,
-- so the new recruiter's follow-up clock starts fresh.
create or replace function bt_candidates_track_assignment() returns trigger
language plpgsql set search_path = public as $fn$
begin
  if new.recruiter_id is distinct from old.recruiter_id then
    new.assigned_at := now();
  end if;
  return new;
end $fn$;

drop trigger if exists bt_candidates_assignment on bt_candidates;
create trigger bt_candidates_assignment before update on bt_candidates
  for each row execute function bt_candidates_track_assignment();

-- ---------------------------------------------------------------------
-- 3. External companies / vendors (one row per company, e.g. Cognizant)
-- ---------------------------------------------------------------------
create table if not exists bt_companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  website     text,
  created_at  timestamptz not null default now()
);
alter table bt_companies enable row level security;
create unique index if not exists bt_companies_name_uq on bt_companies (lower(name));

-- ---------------------------------------------------------------------
-- 4. Vendor contacts — external recruiters, linked to their company
-- ---------------------------------------------------------------------
create table if not exists bt_vendor_contacts (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references bt_companies(id) on delete cascade,
  name        text not null,
  email       text not null,
  phone       text,
  created_at  timestamptz not null default now()
);
alter table bt_vendor_contacts enable row level security;
create unique index if not exists bt_vendor_contacts_email_uq on bt_vendor_contacts (lower(email));
create index if not exists bt_vendor_contacts_company_idx on bt_vendor_contacts(company_id);

-- ---------------------------------------------------------------------
-- 5. Submissions — recruiter submits candidate to a vendor contact
--    (restrict deletes so history is never silently lost)
-- ---------------------------------------------------------------------
create table if not exists bt_submissions (
  id                 uuid primary key default gen_random_uuid(),
  submission_date    date not null default current_date,
  recruiter_id       uuid not null references bt_recruiters(id) on delete restrict,
  candidate_id       uuid not null references bt_candidates(id) on delete restrict,
  company_id         uuid not null references bt_companies(id) on delete restrict,
  vendor_contact_id  uuid not null references bt_vendor_contacts(id) on delete restrict,
  rate               text not null,          -- as quoted, e.g. "$65/hr C2C"
  job_title          text,
  notes              text,
  created_at         timestamptz not null default now()
);
alter table bt_submissions enable row level security;
create index if not exists bt_submissions_date_idx      on bt_submissions(submission_date);
create index if not exists bt_submissions_recruiter_idx on bt_submissions(recruiter_id, submission_date);
create index if not exists bt_submissions_candidate_idx on bt_submissions(candidate_id, submission_date);

-- The chosen contact must belong to the chosen company.
create or replace function bt_submissions_check_contact() returns trigger
language plpgsql set search_path = public as $fn$
begin
  if not exists (select 1 from bt_vendor_contacts
                 where id = new.vendor_contact_id and company_id = new.company_id) then
    raise exception 'Vendor contact does not belong to the selected company';
  end if;
  return new;
end $fn$;

drop trigger if exists bt_submissions_contact_check on bt_submissions;
create trigger bt_submissions_contact_check before insert or update on bt_submissions
  for each row execute function bt_submissions_check_contact();

-- ---------------------------------------------------------------------
-- 6. Interviews — always recorded against one exact submission
-- ---------------------------------------------------------------------
create table if not exists bt_interviews (
  id              uuid primary key default gen_random_uuid(),
  submission_id   uuid not null references bt_submissions(id) on delete cascade,
  interview_date  date not null default current_date,
  round           text,                     -- e.g. "Vendor screen", "Client round 1"
  status          text not null default 'Scheduled'
                  check (status in ('Scheduled','Completed','Selected','Rejected','No show')),
  notes           text,
  created_at      timestamptz not null default now()
);
alter table bt_interviews enable row level security;
create index if not exists bt_interviews_submission_idx on bt_interviews(submission_id);
create index if not exists bt_interviews_date_idx       on bt_interviews(interview_date);

-- ---------------------------------------------------------------------
-- 7. App settings (single row) — follow-up threshold set by admin
-- ---------------------------------------------------------------------
create table if not exists bt_settings (
  id                 int primary key default 1 check (id = 1),
  followup_days      int not null default 2 check (followup_days between 1 and 30),
  followup_enabled   boolean not null default true,
  updated_at         timestamptz not null default now()
);
alter table bt_settings enable row level security;
insert into bt_settings (id) values (1) on conflict (id) do nothing;
-- Temporary: while true, every confirmed account gets full access (no admin
-- list needed). Turn off when real users arrive:
--   update bt_settings set open_access = false where id = 1;
alter table bt_settings add column if not exists open_access boolean not null default false;
-- The team's default look (Appearance), set by an admin. Anyone who has not
-- chosen their own colours, typeface and sizes starts with this.
alter table bt_settings add column if not exists team_prefs jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------
-- 7b. Each person's own Appearance choices, so they follow them to any device.
--     Every signed-in user (recruiter, admin, or waiting) reads and writes only their own row.
-- ---------------------------------------------------------------------
create table if not exists bt_user_prefs (
  user_id     uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  prefs       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
alter table bt_user_prefs enable row level security;
drop policy if exists "own prefs" on bt_user_prefs;
create policy "own prefs" on bt_user_prefs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on bt_user_prefs to authenticated;

-- ---------------------------------------------------------------------
-- 8. Follow-up email log (prevents emailing the same recruiter daily)
-- ---------------------------------------------------------------------
create table if not exists bt_followup_log (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references bt_candidates(id) on delete cascade,
  recruiter_id  uuid not null references bt_recruiters(id) on delete cascade,
  days_idle     int not null,
  sent_on       date not null default current_date,
  sent_at       timestamptz not null default now(),
  -- one email per candidate per day, even if the job runs twice
  unique (candidate_id, sent_on)
);
alter table bt_followup_log enable row level security;
create index if not exists bt_followup_log_candidate_idx on bt_followup_log(candidate_id, sent_at desc);

-- =====================================================================
-- REPORTS
-- =====================================================================

-- Recruiter activity for the dashboard: counts done here, not in the
-- browser, so the API's 1,000-row cap never truncates them. Includes
-- inactive recruiters who had activity in the period, so totals add up.
create or replace function bt_recruiter_activity(p_from date, p_to date)
returns table (
  recruiter_id    uuid,
  recruiter_name  text,
  submissions     int,
  interviews      int,
  interviewed     jsonb   -- [{ "label": "Imran · Cognizant", "count": 2 }]
)
language sql stable set search_path = public as $fn$
  with subs as (
    select recruiter_id, count(*)::int as n
    from bt_submissions
    where submission_date between p_from and p_to
    group by recruiter_id
  ), ints as (
    select s.recruiter_id, c.name || ' · ' || k.name as label, count(*)::int as n
    from bt_interviews i
    join bt_submissions s on s.id = i.submission_id
    join bt_candidates c on c.id = s.candidate_id
    join bt_companies k on k.id = s.company_id
    where i.interview_date between p_from and p_to
    group by s.recruiter_id, label
  )
  select r.id, r.name,
         coalesce(subs.n, 0),
         coalesce((select sum(n)::int from ints where ints.recruiter_id = r.id), 0),
         coalesce((select jsonb_agg(jsonb_build_object('label', label, 'count', n) order by n desc, label)
                   from ints where ints.recruiter_id = r.id), '[]'::jsonb)
  from bt_recruiters r
  left join subs on subs.recruiter_id = r.id
  where r.active or subs.n > 0 or exists (select 1 from ints where ints.recruiter_id = r.id)
  order by 4 desc, 3 desc, r.name;
$fn$;

-- Dashboard trend and outcomes, counted here so the 1,000-row cap never cuts them:
--   days:     [{ "day": "2026-11-16", "submissions": 4, "interviews": 1 }, ...] one row per day, zeros included
--   statuses: { "Scheduled": 3, "Selected": 1, ... } interviews in the period by status
--   p_recruiter: only that recruiter's work (an admin looking at one person); null = everyone the caller may see
drop function if exists bt_dashboard(date, date);
create or replace function bt_dashboard(p_from date, p_to date, p_recruiter uuid default null)
returns jsonb
language sql stable set search_path = public as $fn$
  select jsonb_build_object(
    'days', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'day', d.day,
               'submissions', (select count(*) from bt_submissions s
                               where s.submission_date = d.day and (p_recruiter is null or s.recruiter_id = p_recruiter)),
               'interviews',  (select count(*) from bt_interviews i join bt_submissions s on s.id = i.submission_id
                               where i.interview_date = d.day and (p_recruiter is null or s.recruiter_id = p_recruiter))
             ) order by d.day), '[]'::jsonb)
      from (select g::date as day from generate_series(p_from, p_to, interval '1 day') g) d
    ),
    'statuses', (
      select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
      from (select i.status, count(*)::int as n from bt_interviews i join bt_submissions s on s.id = i.submission_id
            where i.interview_date between p_from and p_to and (p_recruiter is null or s.recruiter_id = p_recruiter)
            group by i.status) t
    )
  );
$fn$;

-- One recruiter's performance for a period, for their profile page:
--   submissions, interviews, selected: counts in [p_from, p_to]
--   statuses: { "Scheduled": 2, ... } that recruiter's interviews in the period by status
--   months:   the six calendar months ending with p_to's month, oldest first,
--             [{ "month": "2026-06-01", "submissions": 9, "interviews": 3 }, ...]
create or replace function bt_recruiter_profile(p_recruiter uuid, p_from date, p_to date)
returns jsonb
language sql stable set search_path = public as $fn$
  select jsonb_build_object(
    'submissions', (select count(*) from bt_submissions s
                    where s.recruiter_id = p_recruiter and s.submission_date between p_from and p_to),
    'interviews',  (select count(*) from bt_interviews i join bt_submissions s on s.id = i.submission_id
                    where s.recruiter_id = p_recruiter and i.interview_date between p_from and p_to),
    'selected',    (select count(*) from bt_interviews i join bt_submissions s on s.id = i.submission_id
                    where s.recruiter_id = p_recruiter and i.status = 'Selected' and i.interview_date between p_from and p_to),
    'statuses', (
      select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
      from (select i.status, count(*)::int as n from bt_interviews i join bt_submissions s on s.id = i.submission_id
            where s.recruiter_id = p_recruiter and i.interview_date between p_from and p_to group by i.status) t
    ),
    'months', (
      select jsonb_agg(jsonb_build_object(
               'month', m.start,
               'submissions', (select count(*) from bt_submissions s
                               where s.recruiter_id = p_recruiter and s.submission_date >= m.start and s.submission_date < m.start + interval '1 month'),
               'interviews',  (select count(*) from bt_interviews i join bt_submissions s on s.id = i.submission_id
                               where s.recruiter_id = p_recruiter and i.interview_date >= m.start and i.interview_date < m.start + interval '1 month')
             ) order by m.start)
      from (select (date_trunc('month', p_to) - make_interval(months => k))::date as start from generate_series(0, 5) k) m
    )
  );
$fn$;

-- Missed submissions: active assigned candidates with ZERO submissions
-- from their assigned recruiter between p_from and p_to (inclusive).
create or replace function bt_missed_submissions(p_from date, p_to date)
returns table (
  candidate_id     uuid,
  candidate_name   text,
  skill            text,
  recruiter_id     uuid,
  recruiter_name   text,
  recruiter_email  text,
  last_submission  date
)
language sql stable set search_path = public as $fn$
  select c.id, c.name, c.skill, r.id, r.name, r.email,
         (select max(s.submission_date) from bt_submissions s
           where s.candidate_id = c.id and s.recruiter_id = r.id)
  from bt_candidates c
  join bt_recruiters r on r.id = c.recruiter_id
  where c.active
    and r.active
    and c.assigned_at::date <= p_to
    and not exists (
      select 1 from bt_submissions s
      where s.candidate_id = c.id
        and s.recruiter_id = c.recruiter_id
        and s.submission_date between p_from and p_to)
  order by r.name, c.name;
$fn$;

-- Follow-ups due now: candidate idle >= threshold days and not already
-- emailed within the last threshold window.
create or replace view bt_followups_due with (security_invoker = true) as
with last_sub as (
  select c.id as candidate_id,
         coalesce(
           (select max(s.submission_date) from bt_submissions s
             where s.candidate_id = c.id and s.recruiter_id = c.recruiter_id),
           c.assigned_at::date) as last_activity
  from bt_candidates c
)
select c.id   as candidate_id,
       c.name as candidate_name,
       c.skill,
       r.id    as recruiter_id,
       r.name  as recruiter_name,
       r.email as recruiter_email,
       ls.last_activity,
       (current_date - greatest(ls.last_activity, c.assigned_at::date))::int as days_idle,
       st.followup_days
from bt_candidates c
join bt_recruiters r on r.id = c.recruiter_id
join last_sub ls on ls.candidate_id = c.id
cross join bt_settings st
where c.active and r.active
  and (current_date - greatest(ls.last_activity, c.assigned_at::date)) >= st.followup_days
  and not exists (
    select 1 from bt_followup_log f
    where f.candidate_id = c.id
      and f.recruiter_id = r.id
      and f.sent_at > now() - make_interval(days => st.followup_days));

-- =====================================================================
-- ACCESS
-- Anyone may create an account on the sign-up page, but an account sees
-- data only when its email is CONFIRMED and is either an active recruiter
-- in bt_recruiters or listed in bt_admins. Everyone else
-- gets a "waiting for access" screen. The follow-up job uses the service
-- role key, which bypasses these rules.
-- A recruiter sees and changes only their own candidates, submissions and
-- interviews; admins see everyone's (policies at the end of this file).
-- =====================================================================
create table if not exists bt_admins (
  email       text primary key check (email = lower(email)),
  created_at  timestamptz not null default now()
);
alter table bt_admins enable row level security;

-- Deactivated accounts: the login stays, but the person has no access (not a member,
-- not an admin) until an admin activates them again. Their records are untouched.
create table if not exists bt_blocked (
  email       text primary key check (email = lower(email)),
  blocked_at  timestamptz not null default now()
);
alter table bt_blocked enable row level security;
-- Add yourself once, before your first sign-in (lowercase):
-- insert into bt_admins (email) values ('you@yourcompany.com');

-- Functions that must read auth.users or bypass row security live in bt_private,
-- a schema the Supabase API does not expose. The app calls the public bt_ names
-- below, which run as the caller (SECURITY INVOKER) and hand off to these.
create schema if not exists bt_private;
revoke all on schema bt_private from public, anon;
grant usage on schema bt_private to authenticated;

create or replace function bt_private.is_member() returns boolean
language sql stable security definer set search_path = '' as $fn$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and u.email_confirmed_at is not null   -- an unconfirmed sign-up can't borrow a recruiter's email
      and ((select open_access from public.bt_settings where id = 1)
        or exists (select 1 from public.bt_admins a where a.email = lower(u.email))
        or exists (select 1 from public.bt_recruiters r where lower(r.email) = lower(u.email) and r.active))
      and not exists (select 1 from public.bt_blocked b where b.email = lower(u.email))
  );
$fn$;
revoke execute on function bt_private.is_member() from public, anon;
grant execute on function bt_private.is_member() to authenticated;

-- Admin = a confirmed account whose email is in bt_admins
create or replace function bt_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $fn$
  select exists (
    select 1 from auth.users u
    join public.bt_admins a on a.email = lower(u.email)
    where u.id = auth.uid() and u.email_confirmed_at is not null
      and not exists (select 1 from public.bt_blocked b where b.email = lower(u.email))
  );
$fn$;
revoke execute on function bt_private.is_admin() from public, anon;
grant execute on function bt_private.is_admin() to authenticated;

-- The signed-in person's own recruiter record (null when they have none).
-- Active or not: a deactivated recruiter who still gets in (open access) sees only their own records.
create or replace function bt_private.my_recruiter_id() returns uuid
language sql stable security definer set search_path = '' as $fn$
  select r.id from auth.users u
  join public.bt_recruiters r on lower(r.email) = lower(u.email)
  where u.id = auth.uid() and u.email_confirmed_at is not null
  limit 1;
$fn$;
revoke execute on function bt_private.my_recruiter_id() from public, anon;
grant execute on function bt_private.my_recruiter_id() to authenticated;

-- Sees every recruiter's records: admins, and members with no recruiter record
-- (only possible while open_access is on). A recruiter sees only their own.
create or replace function bt_private.sees_all() returns boolean
language sql stable security definer set search_path = '' as $fn$
  select bt_private.is_admin() or (bt_private.is_member() and bt_private.my_recruiter_id() is null);
$fn$;
revoke execute on function bt_private.sees_all() from public, anon;
grant execute on function bt_private.sees_all() to authenticated;

-- Everyone who has signed up, with their access, for the Team access page.
-- auth.users is private to Supabase, so only admins may call this.
drop function if exists public.bt_accounts();
drop function if exists bt_private.accounts();
create or replace function bt_private.accounts()
returns table (
  user_id           uuid,
  email             text,
  full_name         text,
  signed_up         timestamptz,
  confirmed         boolean,
  last_sign_in      timestamptz,
  is_admin          boolean,
  recruiter_id      uuid,
  recruiter_active  boolean,
  blocked           boolean
)
language plpgsql stable security definer set search_path = '' as $fn$
begin
  if not bt_private.is_admin() then
    raise exception 'Only admins can see accounts' using errcode = '42501';
  end if;
  return query
    select u.id, u.email::text, coalesce(u.raw_user_meta_data ->> 'full_name', '')::text,
           u.created_at, u.email_confirmed_at is not null, u.last_sign_in_at,
           exists (select 1 from public.bt_admins a where a.email = lower(u.email)),
           r.id, r.active,
           exists (select 1 from public.bt_blocked b where b.email = lower(u.email))
    from auth.users u
    left join public.bt_recruiters r on lower(r.email) = lower(u.email)
    order by u.created_at desc;
end $fn$;
revoke execute on function bt_private.accounts() from public, anon;
grant execute on function bt_private.accounts() to authenticated;

-- Reject a sign-up: deletes the account. Admin-only, and never deletes
-- yourself, an admin or an active recruiter (remove their access first).
create or replace function bt_private.reject_account(p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $fn$
declare em text;
begin
  if not bt_private.is_admin() then
    raise exception 'Only admins can reject accounts' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot reject your own account';
  end if;
  select lower(email) into em from auth.users where id = p_user_id;
  if em is null then return; end if;
  if exists (select 1 from public.bt_admins where email = em)
     or exists (select 1 from public.bt_recruiters where lower(email) = em and active) then
    raise exception 'Remove this person''s access before rejecting the account';
  end if;
  delete from auth.users where id = p_user_id;
end $fn$;
-- Team report for admins: every recruiter's performance in [p_from, p_to].
-- Refuses anyone who is not an admin, whatever the app shows.
create or replace function bt_private.team_report(p_from date, p_to date)
returns table (
  recruiter_id     uuid,
  recruiter_name   text,
  recruiter_email  text,
  active           boolean,
  candidates       int,   -- active candidates assigned now
  idle_candidates  int,   -- of those, none submitted in the period
  submissions      int,
  interviews       int,
  selected         int,
  rejected         int
)
language plpgsql stable security definer set search_path = '' as $fn$
begin
  if not bt_private.is_admin() then
    raise exception 'Only admins can see team reports' using errcode = '42501';
  end if;
  return query
  select r.id, r.name, r.email, r.active,
         (select count(*)::int from public.bt_candidates c where c.recruiter_id = r.id and c.active),
         (select count(*)::int from public.bt_candidates c where c.recruiter_id = r.id and c.active
            and not exists (select 1 from public.bt_submissions s where s.candidate_id = c.id and s.submission_date between p_from and p_to)),
         (select count(*)::int from public.bt_submissions s where s.recruiter_id = r.id and s.submission_date between p_from and p_to),
         (select count(*)::int from public.bt_interviews i join public.bt_submissions s on s.id = i.submission_id
            where s.recruiter_id = r.id and i.interview_date between p_from and p_to),
         (select count(*)::int from public.bt_interviews i join public.bt_submissions s on s.id = i.submission_id
            where s.recruiter_id = r.id and i.status = 'Selected' and i.interview_date between p_from and p_to),
         (select count(*)::int from public.bt_interviews i join public.bt_submissions s on s.id = i.submission_id
            where s.recruiter_id = r.id and i.status = 'Rejected' and i.interview_date between p_from and p_to)
  from public.bt_recruiters r
  where r.active or exists (select 1 from public.bt_submissions s where s.recruiter_id = r.id and s.submission_date between p_from and p_to)
  order by 8 desc, 7 desc, r.name;
end $fn$;
revoke execute on function bt_private.team_report(date, date) from public, anon;
grant execute on function bt_private.team_report(date, date) to authenticated;

revoke execute on function bt_private.reject_account(uuid) from public, anon;
grant execute on function bt_private.reject_account(uuid) to authenticated;

-- Admins still able to act: in bt_admins, confirmed, not deactivated
create or replace function bt_private.active_admins() returns int
language sql stable security definer set search_path = '' as $fn$
  select count(*)::int from public.bt_admins a
  join auth.users u on lower(u.email) = a.email and u.email_confirmed_at is not null
  where not exists (select 1 from public.bt_blocked b where b.email = a.email);
$fn$;

create or replace function bt_private.account_email(p_user_id uuid) returns text
language sql stable security definer set search_path = '' as $fn$
  select lower(email) from auth.users where id = p_user_id;
$fn$;

-- Deactivate or activate an account. Never yourself; never the last active admin.
create or replace function bt_private.set_account_active(p_user_id uuid, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $fn$
declare em text;
begin
  if not bt_private.is_admin() then raise exception 'Only admins can change accounts' using errcode = '42501'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot deactivate your own account'; end if;
  em := bt_private.account_email(p_user_id);
  if em is null then raise exception 'That account no longer exists'; end if;
  if p_active then
    delete from public.bt_blocked where email = em;
  else
    if exists (select 1 from public.bt_admins where email = em) and bt_private.active_admins() <= 1 then
      raise exception 'This is the last active admin. Make someone else an admin first';
    end if;
    insert into public.bt_blocked (email) values (em) on conflict (email) do nothing;
  end if;
end $fn$;

-- Remove admin rights. A recruiter stays a recruiter. Never the last active admin.
create or replace function bt_private.remove_admin(p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $fn$
declare em text;
begin
  if not bt_private.is_admin() then raise exception 'Only admins can change accounts' using errcode = '42501'; end if;
  em := bt_private.account_email(p_user_id);
  if em is null then raise exception 'That account no longer exists'; end if;
  if not exists (select 1 from public.bt_admins where email = em) then return; end if;
  if not exists (select 1 from public.bt_blocked where email = em) and bt_private.active_admins() <= 1 then
    raise exception 'This is the last active admin. Make someone else an admin first';
  end if;
  delete from public.bt_admins where email = em;
end $fn$;

-- Delete an account for good. Its submissions and interviews stay: the recruiter
-- record is kept and set inactive. Never yourself; never the last active admin.
create or replace function bt_private.delete_account(p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $fn$
declare em text;
begin
  if not bt_private.is_admin() then raise exception 'Only admins can delete accounts' using errcode = '42501'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot delete your own account'; end if;
  em := bt_private.account_email(p_user_id);
  if em is null then return; end if;
  if exists (select 1 from public.bt_admins where email = em)
     and not exists (select 1 from public.bt_blocked where email = em)
     and bt_private.active_admins() <= 1 then
    raise exception 'This is the last active admin. Make someone else an admin first';
  end if;
  delete from public.bt_admins where email = em;
  delete from public.bt_blocked where email = em;
  update public.bt_recruiters set active = false where lower(email) = em;
  delete from auth.users where id = p_user_id;
end $fn$;

revoke execute on function bt_private.active_admins(), bt_private.account_email(uuid), bt_private.set_account_active(uuid, boolean),
                           bt_private.remove_admin(uuid), bt_private.delete_account(uuid) from public, anon;
grant execute on function bt_private.active_admins(), bt_private.account_email(uuid), bt_private.set_account_active(uuid, boolean),
                          bt_private.remove_admin(uuid), bt_private.delete_account(uuid) to authenticated;

-- The names the app calls (rpc). SECURITY INVOKER: they run with the caller's own rights
-- and only pass through to bt_private, which still enforces member and admin checks.
create or replace function public.bt_is_member() returns boolean
language sql stable security invoker set search_path = '' as $fn$ select bt_private.is_member() $fn$;
create or replace function public.bt_is_admin() returns boolean
language sql stable security invoker set search_path = '' as $fn$ select bt_private.is_admin() $fn$;
create or replace function public.bt_accounts()
returns table (user_id uuid, email text, full_name text, signed_up timestamptz, confirmed boolean,
               last_sign_in timestamptz, is_admin boolean, recruiter_id uuid, recruiter_active boolean, blocked boolean)
language sql stable security invoker set search_path = '' as $fn$ select * from bt_private.accounts() $fn$;
create or replace function public.bt_set_account_active(p_user_id uuid, p_active boolean) returns void
language sql security invoker set search_path = '' as $fn$ select bt_private.set_account_active(p_user_id, p_active) $fn$;
create or replace function public.bt_remove_admin(p_user_id uuid) returns void
language sql security invoker set search_path = '' as $fn$ select bt_private.remove_admin(p_user_id) $fn$;
create or replace function public.bt_delete_account(p_user_id uuid) returns void
language sql security invoker set search_path = '' as $fn$ select bt_private.delete_account(p_user_id) $fn$;
revoke execute on function public.bt_set_account_active(uuid, boolean), public.bt_remove_admin(uuid), public.bt_delete_account(uuid) from public, anon;
grant execute on function public.bt_set_account_active(uuid, boolean), public.bt_remove_admin(uuid), public.bt_delete_account(uuid) to authenticated;
create or replace function public.bt_reject_account(p_user_id uuid) returns void
language sql security invoker set search_path = '' as $fn$ select bt_private.reject_account(p_user_id) $fn$;
create or replace function public.bt_team_report(p_from date, p_to date)
returns table (recruiter_id uuid, recruiter_name text, recruiter_email text, active boolean, candidates int,
               idle_candidates int, submissions int, interviews int, selected int, rejected int)
language sql stable security invoker set search_path = '' as $fn$ select * from bt_private.team_report(p_from, p_to) $fn$;
revoke execute on function public.bt_is_member(), public.bt_is_admin(), public.bt_accounts(),
                           public.bt_reject_account(uuid), public.bt_team_report(date, date) from public, anon;
grant execute on function public.bt_is_member(), public.bt_is_admin(), public.bt_accounts(),
                          public.bt_reject_account(uuid), public.bt_team_report(date, date) to authenticated;

do $fn$
declare t text;
begin
  foreach t in array array['bt_candidates','bt_companies','bt_vendor_contacts','bt_submissions','bt_interviews']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "signed-in full access" on %I', t);
    execute format('drop policy if exists "members full access" on %I', t);
    execute format('drop policy if exists "own records" on %I', t);
  end loop;
  -- the shared directory of vendor companies and their contacts: every approved member reads and writes it
  foreach t in array array['bt_companies','bt_vendor_contacts']
  loop
    -- (select ...) runs the check once per query, not once per row
    execute format('create policy "members full access" on %I for all to authenticated using ((select bt_private.is_member())) with check ((select bt_private.is_member()))', t);
  end loop;
end $fn$;

-- Candidates, submissions and interviews belong to a recruiter. A recruiter reads and
-- writes only their own and can never see, add, change or delete another recruiter's;
-- admins see and change everyone's. The reports run with the caller's rights, so a
-- recruiter's dashboard counts only their own work.
create policy "own records" on bt_candidates for all to authenticated
  using ((select bt_private.is_member()) and ((select bt_private.sees_all()) or recruiter_id = (select bt_private.my_recruiter_id())))
  with check ((select bt_private.is_member()) and ((select bt_private.sees_all()) or recruiter_id = (select bt_private.my_recruiter_id())));
-- a submission can only be saved for a candidate you can see (key checks alone would let
-- a recruiter who knows another recruiter's candidate id submit them)
create policy "own records" on bt_submissions for all to authenticated
  using ((select bt_private.is_member()) and ((select bt_private.sees_all()) or recruiter_id = (select bt_private.my_recruiter_id())))
  with check ((select bt_private.is_member()) and ((select bt_private.sees_all()) or recruiter_id = (select bt_private.my_recruiter_id()))
              and exists (select 1 from public.bt_candidates c where c.id = bt_submissions.candidate_id));
-- an interview belongs to whoever owns its submission (the submissions rule above filters this lookup)
create policy "own records" on bt_interviews for all to authenticated
  using ((select bt_private.is_member()) and exists (select 1 from public.bt_submissions s where s.id = bt_interviews.submission_id))
  with check ((select bt_private.is_member()) and exists (select 1 from public.bt_submissions s where s.id = bt_interviews.submission_id));

-- Tables that decide who gets in and how the app behaves: members may read,
-- only admins may change. (Before this, any member could add themselves to
-- bt_admins or switch on open_access from the browser console.)
do $fn$
declare t text;
begin
  foreach t in array array['bt_recruiters','bt_settings','bt_followup_log','bt_admins']
  loop
    execute format('drop policy if exists "members full access" on %I', t);
    execute format('drop policy if exists "members read" on %I', t);
    execute format('drop policy if exists "admins write" on %I', t);
  end loop;
end $fn$;
-- recruiters: admins read the whole team; a recruiter reads only their own row.
-- Adding, editing and removing is for admins
create policy "members read" on bt_recruiters for select to authenticated
  using ((select bt_private.is_member()) and ((select bt_private.sees_all()) or id = (select bt_private.my_recruiter_id())));
create policy "admins write" on bt_recruiters for all to authenticated
  using ((select bt_private.is_admin())) with check ((select bt_private.is_admin()));
-- settings: members read the rule and the team look; only admins change them (open_access too)
create policy "members read" on bt_settings for select to authenticated using ((select bt_private.is_member()));
create policy "admins write" on bt_settings for update to authenticated
  using ((select bt_private.is_admin())) with check ((select bt_private.is_admin()));
-- follow-up log: admins read all of it, a recruiter only their own lines; only the email
-- job writes it (service role, which bypasses row security)
create policy "members read" on bt_followup_log for select to authenticated
  using ((select bt_private.is_member()) and ((select bt_private.sees_all()) or recruiter_id = (select bt_private.my_recruiter_id())));
-- admins list: only admins see or change it (membership checks read it through bt_private)
drop policy if exists "admins write" on bt_blocked;
create policy "admins write" on bt_blocked for all to authenticated
  using ((select bt_private.is_admin())) with check ((select bt_private.is_admin()));
create policy "admins write" on bt_admins for all to authenticated
  using ((select bt_private.is_admin())) with check ((select bt_private.is_admin()));

-- Recruiter emails are unique whatever their capitals, matching how access is checked
create unique index if not exists bt_recruiters_email_lower_uq on bt_recruiters (lower(email));
-- A person's saved look stays small
do $fn$
begin
  if not exists (select 1 from pg_constraint where conname = 'bt_user_prefs_size') then
    alter table bt_user_prefs add constraint bt_user_prefs_size check (pg_column_size(prefs) < 4096);
  end if;
end $fn$;

-- Signed-out visitors can call nothing; signed-in members get the reports
revoke execute on function bt_missed_submissions(date, date), bt_recruiter_activity(date, date), bt_dashboard(date, date, uuid),
                           bt_recruiter_profile(uuid, date, date), bt_candidates_track_assignment(), bt_submissions_check_contact() from public, anon;
grant execute on function bt_missed_submissions(date, date) to authenticated;
grant execute on function bt_recruiter_activity(date, date) to authenticated;
grant execute on function bt_dashboard(date, date, uuid) to authenticated;
grant execute on function bt_recruiter_profile(uuid, date, date) to authenticated;
grant select on bt_followups_due to authenticated;

-- Live updates: the app listens for changes to these tables (Supabase Realtime) and reloads the open
-- page in place. Row security still decides who hears what: a recruiter only hears of their own
-- records. Safe to re-run: a table already in the publication is left as it is.
do $fn$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['bt_submissions','bt_interviews','bt_candidates','bt_recruiters','bt_companies',
                           'bt_vendor_contacts','bt_settings','bt_followup_log','bt_admins','bt_blocked']
  loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $fn$;
