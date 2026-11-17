-- =====================================================================
-- Bench Tracker: rename bench_subm_* to bt_* on an EXISTING database.
-- Run this ONCE in the Supabase SQL Editor, BEFORE running schema.sql again.
-- Every table keeps all of its rows; only the names change.
-- A database that never had bench_subm_ tables does not need this file.
-- =====================================================================
begin;

-- Old functions, the old view, and the triggers and policies that use them.
-- schema.sql recreates all of them under the bt_ names.
drop view if exists bench_subm_followups_due;
do $mig$
declare r record;
begin
  for r in select p.oid::regprocedure as fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'bench\_subm\_%'
  loop
    execute format('drop function if exists %s cascade', r.fn);
  end loop;
end $mig$;

-- Tables
alter table if exists bench_subm_recruiters rename to bt_recruiters;
alter table if exists bench_subm_candidates rename to bt_candidates;
alter table if exists bench_subm_companies rename to bt_companies;
alter table if exists bench_subm_vendor_contacts rename to bt_vendor_contacts;
alter table if exists bench_subm_submissions rename to bt_submissions;
alter table if exists bench_subm_interviews rename to bt_interviews;
alter table if exists bench_subm_settings rename to bt_settings;
alter table if exists bench_subm_user_prefs rename to bt_user_prefs;
alter table if exists bench_subm_followup_log rename to bt_followup_log;
alter table if exists bench_subm_admins rename to bt_admins;

-- Indexes
alter index if exists bench_subm_candidates_recruiter_idx rename to bt_candidates_recruiter_idx;
alter index if exists bench_subm_companies_name_uq rename to bt_companies_name_uq;
alter index if exists bench_subm_vendor_contacts_email_uq rename to bt_vendor_contacts_email_uq;
alter index if exists bench_subm_vendor_contacts_company_idx rename to bt_vendor_contacts_company_idx;
alter index if exists bench_subm_submissions_date_idx rename to bt_submissions_date_idx;
alter index if exists bench_subm_submissions_recruiter_idx rename to bt_submissions_recruiter_idx;
alter index if exists bench_subm_submissions_candidate_idx rename to bt_submissions_candidate_idx;
alter index if exists bench_subm_interviews_submission_idx rename to bt_interviews_submission_idx;
alter index if exists bench_subm_interviews_date_idx rename to bt_interviews_date_idx;
alter index if exists bench_subm_followup_log_candidate_idx rename to bt_followup_log_candidate_idx;

-- Everything else Postgres named after the tables (primary keys, unique keys,
-- sequences): same rename, so no bench_subm_ name is left behind.
do $mig$
declare r record;
begin
  for r in select c.relname, c.relkind from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relname like 'bench\_subm\_%' and c.relkind in ('i', 'S')
  loop
    execute format('alter %s %I rename to %I', case r.relkind when 'S' then 'sequence' else 'index' end,
                   r.relname, 'bt_' || substr(r.relname, 12));
  end loop;
end $mig$;

commit;

-- Next: run supabase/schema.sql (it recreates the functions, view, triggers and access rules).
