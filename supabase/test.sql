-- Tests for the core reports. Run after schema.sql, in the Supabase SQL
-- Editor. Everything runs inside a transaction that is rolled back, so no
-- data is left behind. Any failure stops with "assertion failed: ...".
begin;

do $t$
declare
  abdul uuid; anshuman uuid; imran uuid; kavya uuid; cog uuid; daniel uuid; infy uuid; sub uuid;
  n int; rec record;
begin
  insert into bt_recruiters (name, email) values ('Abdul (test)', 'abdul.test@example.com') returning id into abdul;
  insert into bt_recruiters (name, email) values ('Anshuman (test)', 'anshuman.test@example.com') returning id into anshuman;
  insert into bt_candidates (name, recruiter_id, assigned_at) values ('Imran (test)', abdul, now() - interval '10 days') returning id into imran;
  insert into bt_candidates (name, recruiter_id, assigned_at) values ('Kavya (test)', abdul, now() - interval '10 days') returning id into kavya;
  insert into bt_companies (name) values ('Cognizant (test)') returning id into cog;
  insert into bt_companies (name) values ('Infosys (test)') returning id into infy;
  insert into bt_vendor_contacts (company_id, name, email) values (cog, 'Daniel', 'daniel.test@example.com') returning id into daniel;
  update bt_settings set followup_days = 2, followup_enabled = true where id = 1;

  -- Abdul submits Imran yesterday; Imran gets an interview today
  insert into bt_submissions (submission_date, recruiter_id, candidate_id, company_id, vendor_contact_id, rate)
  values (current_date - 1, abdul, imran, cog, daniel, '$65/hr') returning id into sub;
  insert into bt_interviews (submission_id, interview_date) values (sub, current_date);

  -- 1. Missed submissions flags Kavya only, with Abdul as the recruiter
  select count(*) into n from bt_missed_submissions(current_date - 6, current_date) where recruiter_id = abdul;
  assert n = 1, 'missed: expected exactly 1 candidate for Abdul, got ' || n;
  select * into rec from bt_missed_submissions(current_date - 6, current_date) where recruiter_id = abdul;
  assert rec.candidate_id = kavya, 'missed: expected Kavya, got ' || rec.candidate_name;

  -- 2. Activity counts Abdul's submission and interview, and names them
  select * into rec from bt_recruiter_activity(current_date - 6, current_date) where recruiter_id = abdul;
  assert rec.submissions = 1 and rec.interviews = 1, 'activity: expected 1 submission and 1 interview';
  assert rec.interviewed -> 0 ->> 'label' = 'Imran (test) · Cognizant (test)', 'activity: wrong interviewed label: ' || rec.interviewed;

  -- 2b. Dashboard: one row per day (zeros kept), yesterday's submission and today's interview counted
  assert jsonb_array_length(bt_dashboard(current_date - 6, current_date) -> 'days') = 7, 'dashboard: expected 7 days';
  assert (bt_dashboard(current_date - 1, current_date - 1) -> 'days' -> 0 ->> 'submissions')::int >= 1, 'dashboard: yesterday submission not counted';
  assert (bt_dashboard(current_date, current_date) -> 'statuses' ->> 'Scheduled')::int >= 1, 'dashboard: today interview status not counted';

  -- 2c. Recruiter profile: Abdul's submission and interview counted, six months returned
  assert (bt_recruiter_profile(abdul, current_date - 6, current_date) ->> 'submissions')::int = 1, 'profile: expected 1 submission';
  assert (bt_recruiter_profile(abdul, current_date - 6, current_date) ->> 'interviews')::int = 1, 'profile: expected 1 interview';
  assert jsonb_array_length(bt_recruiter_profile(abdul, current_date - 6, current_date) -> 'months') = 6, 'profile: expected 6 months';
  assert (bt_recruiter_profile(anshuman, current_date - 6, current_date) ->> 'submissions')::int = 0, 'profile: Anshuman should have none';

  -- 2d. Appearance: the team default lives on settings, and each user's own choices in user_prefs
  update bt_settings set team_prefs = '{"accent": "#0f766e"}' where id = 1;
  assert (select team_prefs ->> 'accent' from bt_settings where id = 1) = '#0f766e', 'prefs: team default not stored';
  insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-0000000000aa', 'prefs.test@example.com', now());
  insert into bt_user_prefs (user_id, prefs) values ('00000000-0000-0000-0000-0000000000aa', '{"mode": "dark", "fonts": "fabric"}')
    on conflict (user_id) do update set prefs = excluded.prefs;
  assert (select prefs ->> 'fonts' from bt_user_prefs where user_id = '00000000-0000-0000-0000-0000000000aa') = 'fabric', 'prefs: own choices not stored';

  -- 2e. Team report: only admins; counts Abdul's submission and interview
  begin
    perform * from bt_team_report(current_date - 6, current_date);
    assert false, 'team report: a non-admin was allowed';
  exception when insufficient_privilege then null;
  end;
  insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-0000000000bb', 'report.admin@example.com', now());
  insert into bt_admins (email) values ('report.admin@example.com');
  perform set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000bb"}', true);
  select * into rec from bt_team_report(current_date - 6, current_date) where recruiter_id = abdul;
  assert rec.submissions = 1 and rec.interviews = 1 and rec.candidates = 2, 'team report: wrong counts for Abdul ' || rec::text;
  perform set_config('request.jwt.claims', '', true);

  -- 3. Follow-ups (threshold 2 days): Kavya is due (idle 10 days), Imran is not (1 day)
  assert exists (select 1 from bt_followups_due where candidate_id = kavya), 'followups: Kavya should be due';
  assert not exists (select 1 from bt_followups_due where candidate_id = imran), 'followups: Imran should not be due';

  -- 4. Once emailed today, Kavya is no longer due, and a second log row for today is rejected
  insert into bt_followup_log (candidate_id, recruiter_id, days_idle) values (kavya, abdul, 10);
  assert not exists (select 1 from bt_followups_due where candidate_id = kavya), 'followups: Kavya was emailed, should not be due';
  begin
    insert into bt_followup_log (candidate_id, recruiter_id, days_idle) values (kavya, abdul, 10);
    assert false, 'followup_log: duplicate same-day row was accepted';
  exception when unique_violation then null;
  end;

  -- 5. A vendor contact from another company is rejected
  begin
    insert into bt_submissions (recruiter_id, candidate_id, company_id, vendor_contact_id, rate) values (abdul, imran, infy, daniel, '$60/hr');
    assert false, 'submissions: contact from another company was accepted';
  exception when raise_exception then null;
  end;

  -- 6. Reassigning a candidate restarts the new recruiter's clock
  update bt_candidates set recruiter_id = anshuman where id = kavya;
  assert (select assigned_at::date from bt_candidates where id = kavya) = current_date, 'reassign: assigned_at was not reset';
  assert not exists (select 1 from bt_followups_due where candidate_id = kavya), 'reassign: Kavya should not be due for Anshuman yet';

  -- 7. Access: only confirmed emails of active recruiters or admins are members
  declare
    u_rec uuid := gen_random_uuid(); u_unconf uuid := gen_random_uuid(); u_stranger uuid := gen_random_uuid(); u_admin uuid := gen_random_uuid();
    is_member boolean;
  begin
    insert into auth.users (id, email, email_confirmed_at) values
      (u_rec, 'Abdul.Test@example.com', now()),        -- recruiter (case differs on purpose)
      (u_unconf, 'anshuman.test@example.com', null),      -- recruiter's email, never confirmed
      (u_stranger, 'stranger@example.com', now()),    -- confirmed, but nobody added them
      (u_admin, 'boss.test@example.com', now());
    insert into bt_admins (email) values ('boss.test@example.com');

    perform set_config('request.jwt.claims', json_build_object('sub', u_rec)::text, true);
    assert public.bt_is_member(), 'access: confirmed active recruiter should be a member';
    perform set_config('request.jwt.claims', json_build_object('sub', u_unconf)::text, true);
    assert not public.bt_is_member(), 'access: unconfirmed email must not be a member';
    perform set_config('request.jwt.claims', json_build_object('sub', u_stranger)::text, true);
    assert not public.bt_is_member(), 'access: stranger must not be a member';
    perform set_config('request.jwt.claims', json_build_object('sub', u_admin)::text, true);
    assert public.bt_is_member(), 'access: admin should be a member';
    update bt_recruiters set active = false where id = abdul;
    perform set_config('request.jwt.claims', json_build_object('sub', u_rec)::text, true);
    assert not public.bt_is_member(), 'access: deactivated recruiter must lose access';
    -- admin-only account list: admins see everyone, others are refused
    perform set_config('request.jwt.claims', json_build_object('sub', u_admin)::text, true);
    assert public.bt_is_admin(), 'admin: boss should be admin';
    assert (select count(*) from public.bt_accounts() where email in ('anshuman.test@example.com', 'stranger@example.com')) = 2, 'accounts: admin should see sign-ups';
    assert (select is_admin from public.bt_accounts() where email = 'boss.test@example.com'), 'accounts: admin flag missing';
    -- reject: admins can delete a waiting sign-up, but never themselves or an admin
    begin
      perform public.bt_reject_account(u_admin);
      assert false, 'reject: admin was allowed to delete their own account';
    exception when raise_exception then null;
    end;
    begin
      perform public.bt_reject_account(u_unconf);  -- anshuman.test@ is an active recruiter
      assert false, 'reject: an active recruiter''s account was deleted';
    exception when raise_exception then null;
    end;
    insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-4000-8000-000000000099', 'waiting@example.com', now());
    perform public.bt_reject_account('00000000-0000-4000-8000-000000000099');
    assert not exists (select 1 from auth.users where email = 'waiting@example.com'), 'reject: waiting sign-up was not deleted';

    perform set_config('request.jwt.claims', json_build_object('sub', u_stranger)::text, true);
    assert not public.bt_is_admin(), 'admin: stranger must not be admin';
    begin
      perform public.bt_reject_account(u_rec);
      assert false, 'reject: non-admin was allowed to reject';
    exception when insufficient_privilege then null;
    end;
    begin
      perform public.bt_accounts();
      assert false, 'accounts: non-admin was allowed to list accounts';
    exception when insufficient_privilege then null;
    end;

    -- open sign-up lets any confirmed account in, never an unconfirmed one
    update bt_settings set open_access = true where id = 1;
    perform set_config('request.jwt.claims', json_build_object('sub', u_stranger)::text, true);
    assert public.bt_is_member(), 'open access: confirmed stranger should be a member';
    perform set_config('request.jwt.claims', json_build_object('sub', u_unconf)::text, true);
    assert not public.bt_is_member(), 'open access: unconfirmed email must still be kept out';
    update bt_settings set open_access = false where id = 1;
    perform set_config('request.jwt.claims', json_build_object('sub', u_stranger)::text, true);
    assert not public.bt_is_member(), 'open access off: stranger must lose access';
    perform set_config('request.jwt.claims', '', true);
  end;

  raise notice 'All bt tests passed';
end $t$;

-- 5. Row security, as a signed-in recruiter (a member, not an admin)
do $t$
declare n int; me uuid; other uuid; other_cand uuid; cog uuid; daniel uuid; mine uuid;
begin
  insert into bt_recruiters (name, email) values ('Rls (test)', 'rls.test@example.com') returning id into me;
  insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-0000000000cc', 'rls.test@example.com', now());
  select id into other from bt_recruiters where email = 'anshuman.test@example.com';
  select id into other_cand from bt_candidates where recruiter_id = other limit 1;   -- Kavya, reassigned to Anshuman
  select id into cog from bt_companies where name = 'Cognizant (test)';
  select id into daniel from bt_vendor_contacts where email = 'daniel.test@example.com';
  -- dashboard for one recruiter (as an admin picks one): Abdul's submission yesterday, none for Anshuman
  assert (bt_dashboard(current_date - 1, current_date - 1, other) -> 'days' -> 0 ->> 'submissions')::int = 0, 'dashboard: Anshuman should have no submissions';
  perform set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000cc"}', true);
  set local role authenticated;
  assert (select bt_is_member()), 'rls: the recruiter should be a member';
  assert not (select bt_is_admin()), 'rls: the recruiter should not be an admin';
  select count(*) into n from bt_recruiters;
  assert n = 1, 'rls: a recruiter should see only their own recruiter row, saw ' || n;
  -- another recruiter's candidates, submissions, interviews and follow-ups stay invisible
  assert not exists (select 1 from bt_candidates), 'rls: a recruiter saw another recruiter''s candidates';
  assert not exists (select 1 from bt_submissions), 'rls: a recruiter saw another recruiter''s submissions';
  assert not exists (select 1 from bt_interviews), 'rls: a recruiter saw another recruiter''s interviews';
  assert not exists (select 1 from bt_followup_log), 'rls: a recruiter saw another recruiter''s follow-ups';
  assert not exists (select 1 from bt_followups_due), 'rls: a recruiter saw another recruiter''s due follow-ups';
  assert (select coalesce(sum(submissions), 0) from bt_recruiter_activity(current_date - 30, current_date)) = 0, 'rls: activity counted someone else''s work';
  assert (bt_dashboard(current_date - 1, current_date - 1) -> 'days' -> 0 ->> 'submissions')::int = 0, 'rls: dashboard counted someone else''s submission';
  -- nor can they be changed, or new ones made in another recruiter's name
  update bt_candidates set name = 'Hijacked' where id = other_cand;
  get diagnostics n = row_count;
  assert n = 0, 'rls: a recruiter changed another recruiter''s candidate';
  delete from bt_candidates where id = other_cand;
  get diagnostics n = row_count;
  assert n = 0, 'rls: a recruiter deleted another recruiter''s candidate';
  begin
    insert into bt_candidates (name, recruiter_id) values ('Planted (test)', other);
    assert false, 'rls: a recruiter added a candidate for someone else';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into bt_submissions (recruiter_id, candidate_id, company_id, vendor_contact_id, rate) values (me, other_cand, cog, daniel, '$1/hr');
    assert false, 'rls: a recruiter submitted another recruiter''s candidate';
  exception when insufficient_privilege then null;
  end;
  -- their own work is theirs to add and see
  insert into bt_candidates (name, recruiter_id) values ('Mine (test)', me) returning id into mine;
  insert into bt_submissions (recruiter_id, candidate_id, company_id, vendor_contact_id, rate) values (me, mine, cog, daniel, '$70/hr');
  assert (select count(*) from bt_submissions) = 1, 'rls: a recruiter should see their own submission';
  begin
    insert into bt_admins (email) values ('rls.test@example.com');
    assert false, 'rls: a member made themselves admin';
  exception when insufficient_privilege then null;
  end;
  update bt_settings set open_access = true where id = 1;
  get diagnostics n = row_count;
  assert n = 0, 'rls: a member changed settings';
  begin
    insert into bt_recruiters (name, email) values ('Sneaky', 'sneaky@example.com');
    assert false, 'rls: a member added a recruiter';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into bt_followup_log (candidate_id, recruiter_id, days_idle) select id, recruiter_id, 1 from bt_candidates limit 1;
    assert false, 'rls: a member wrote the follow-up log';
  exception when insufficient_privilege then null;
  end;
  insert into bt_companies (name) values ('Member can add (test)');   -- working tables stay open to members
  reset role;
  raise notice 'Row security tests passed';
end $t$;

-- 6. Account controls: deactivate, activate, remove admin, delete, and their guards
do $t$
declare boss uuid := '00000000-0000-0000-0000-0000000000d1'; second uuid := '00000000-0000-0000-0000-0000000000d2';
        rec uuid := '00000000-0000-0000-0000-0000000000d3'; rid uuid; n int;
begin
  insert into auth.users (id, email, email_confirmed_at) values
    (boss, 'boss.acct@example.com', now()), (second, 'second.acct@example.com', now()), (rec, 'rec.acct@example.com', now());
  insert into bt_admins (email) values ('boss.acct@example.com'), ('second.acct@example.com');
  insert into bt_recruiters (name, email) values ('Rec (test)', 'rec.acct@example.com') returning id into rid;
  insert into bt_candidates (name, recruiter_id) values ('Kept candidate (test)', rid);
  insert into bt_submissions (recruiter_id, candidate_id, company_id, vendor_contact_id, rate)
    select rid, (select id from bt_candidates where name = 'Kept candidate (test)'), company_id, id, '$50/hr' from bt_vendor_contacts limit 1;

  perform set_config('request.jwt.claims', json_build_object('sub', boss)::text, true);
  -- deactivate a recruiter: no access; activate: access again
  perform bt_set_account_active(rec, false);
  perform set_config('request.jwt.claims', json_build_object('sub', rec)::text, true);
  assert not bt_is_member(), 'accounts: a deactivated recruiter still has access';
  perform set_config('request.jwt.claims', json_build_object('sub', boss)::text, true);
  assert (select blocked from bt_accounts() where user_id = rec), 'accounts: the list should show deactivated';
  perform bt_set_account_active(rec, true);
  perform set_config('request.jwt.claims', json_build_object('sub', rec)::text, true);
  assert bt_is_member(), 'accounts: an activated recruiter should have access';
  perform set_config('request.jwt.claims', json_build_object('sub', boss)::text, true);
  -- never yourself
  begin perform bt_set_account_active(boss, false); assert false, 'accounts: deactivated yourself';
  exception when raise_exception then null; end;
  begin perform bt_delete_account(boss); assert false, 'accounts: deleted yourself';
  exception when raise_exception then null; end;
  -- remove the second admin; then the boss is the last admin and can't be removed or deactivated
  perform bt_remove_admin(second);
  assert not exists (select 1 from bt_admins where email = 'second.acct@example.com'), 'accounts: admin not removed';
  select count(*) into n from bt_admins a join auth.users u on lower(u.email) = a.email
    where not exists (select 1 from bt_blocked b where b.email = a.email);
  if n = 1 then
    begin perform bt_remove_admin(boss); assert false, 'accounts: removed the last admin';
    exception when raise_exception then null; end;
  end if;
  -- delete the recruiter's account: the login goes, the history stays
  perform bt_delete_account(rec);
  assert not exists (select 1 from auth.users where id = rec), 'accounts: account not deleted';
  assert exists (select 1 from bt_submissions where recruiter_id = rid), 'accounts: submissions were lost';
  assert not (select active from bt_recruiters where id = rid), 'accounts: recruiter record should be inactive';
  perform set_config('request.jwt.claims', '', true);
  raise notice 'Account control tests passed';
end $t$;

rollback;
