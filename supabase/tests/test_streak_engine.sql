-- ============================================================================
-- Streak engine tests.
--
-- Run with: bash scripts/localdb.sh --test
-- Every assertion raises on failure, so a clean run means a green suite.
-- ============================================================================

\set ON_ERROR_STOP on
set client_min_messages to notice;

create or replace function pg_temp.assert_eq(actual anyelement, expected anyelement, label text)
returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL % : expected %, got %', label, expected, actual;
  end if;
  raise notice '  ok  %', label;
end;
$$;

create or replace function pg_temp.assert_raises(stmt text, label text)
returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    raise notice '  ok  % (raised %)', label, sqlerrm;
    return;
  end;
  raise exception 'FAIL % : expected an exception, none raised', label;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
begin;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@ksu.edu'),
  ('22222222-2222-2222-2222-222222222222', 'b@ksu.edu'),
  ('33333333-3333-3333-3333-333333333333', 'c@ksu.edu');

insert into public.universities (id, code, name_en, name_ar, short_name_en, short_name_ar, timezone)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'KSU', 'King Saud University',
        'جامعة الملك سعود', 'KSU', 'جامعة الملك سعود', 'Asia/Riyadh');

insert into public.profiles (id, university_id, username, username_normalized, anon_tag, timezone)
values
 ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'aisha', 'aisha', 1001, 'Asia/Riyadh'),
 ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000001', 'bilal', 'bilal', 1002, 'Asia/Riyadh'),
 ('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-0000-0000-0000-000000000001', 'carim', 'carim', 1003, 'America/New_York');

insert into public.badges (id, emoji, name_key, rule_kind, rule_value) values
  ('streak_7',   '🔥', 'badges.streak7',   'streak_length', 7),
  ('streak_30',  '🔥', 'badges.streak30',  'streak_length', 30),
  ('streak_100', '🔥', 'badges.streak100', 'streak_length', 100);

\echo ''
\echo '== day-1 records as PENDING, never as "1 day" (§14) =='
do $$
declare
  s public.streaks;
  d0 timestamptz := '2026-03-01 09:00+03';
begin
  s := app_private.ensure_direct_streak(
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222');

  -- Only A has spoken: nothing completes.
  s := app_private.record_streak_activity(s.id, '11111111-1111-1111-1111-111111111111',
        'direct_message', null, d0);
  perform pg_temp.assert_eq(s.status, 'pending'::public.streak_status, 'one-sided: status pending');
  perform pg_temp.assert_eq(s.current_length, 0, 'one-sided: length 0');
  perform pg_temp.assert_eq(s.last_qualified_on, null::date, 'one-sided: no qualified day');

  -- B replies the same local day: the day completes, but it is still pending.
  s := app_private.record_streak_activity(s.id, '22222222-2222-2222-2222-222222222222',
        'direct_message', null, d0 + interval '2 hours');
  perform pg_temp.assert_eq(s.status, 'pending'::public.streak_status, 'day 1: status pending');
  perform pg_temp.assert_eq(s.current_length, 0, 'day 1: length stays 0');
  perform pg_temp.assert_eq(s.last_qualified_on, date '2026-03-01', 'day 1: qualified');
end $$;

\echo ''
\echo '== second consecutive day becomes 2, not 1 (§14) =='
do $$
declare s public.streaks; sid uuid; d1 timestamptz := '2026-03-02 10:00+03';
begin
  select id into sid from public.streaks where scope='direct';
  s := app_private.record_streak_activity(sid, '11111111-1111-1111-1111-111111111111', 'direct_message', null, d1);
  perform pg_temp.assert_eq(s.current_length, 0, 'day 2 half-done: still 0');
  s := app_private.record_streak_activity(sid, '22222222-2222-2222-2222-222222222222', 'direct_message', null, d1);
  perform pg_temp.assert_eq(s.status, 'active'::public.streak_status, 'day 2: active');
  perform pg_temp.assert_eq(s.current_length, 2, 'day 2: length 2 (never 1)');
end $$;

\echo ''
\echo '== each further day increments by exactly one =='
do $$
declare s public.streaks; sid uuid; d date;
begin
  select id into sid from public.streaks where scope='direct';
  for i in 3..7 loop
    d := date '2026-03-01' + (i - 1);
    s := app_private.record_streak_activity(sid, '11111111-1111-1111-1111-111111111111',
          'direct_message', null, (d::timestamp + time '09:00') at time zone 'Asia/Riyadh');
    s := app_private.record_streak_activity(sid, '22222222-2222-2222-2222-222222222222',
          'direct_message', null, (d::timestamp + time '21:00') at time zone 'Asia/Riyadh');
    perform pg_temp.assert_eq(s.current_length, i, format('day %s: length %s', i, i));
  end loop;
end $$;

\echo ''
\echo '== spam does not inflate a streak (§15) =='
do $$
declare s public.streaks; sid uuid; before_len integer; events_before bigint; events_after bigint;
begin
  select id into sid from public.streaks where scope='direct';
  select current_length into before_len from public.streaks where id = sid;
  select count(*) into events_before from public.streak_events where streak_id = sid;

  -- 50 messages from each side, all on the already-completed day 7.
  for i in 1..50 loop
    s := app_private.record_streak_activity(sid, '11111111-1111-1111-1111-111111111111',
          'direct_message', null, '2026-03-07 23:00+03');
    s := app_private.record_streak_activity(sid, '22222222-2222-2222-2222-222222222222',
          'direct_message', null, '2026-03-07 23:30+03');
  end loop;

  select count(*) into events_after from public.streak_events where streak_id = sid;
  perform pg_temp.assert_eq(s.current_length, before_len, 'spam: length unchanged');
  perform pg_temp.assert_eq(events_after, events_before, 'spam: no new ledger events');
end $$;

\echo ''
\echo '== milestone badge awarded at 7 days (§26) =='
do $$
declare n bigint;
begin
  select count(*) into n from public.user_badges
   where badge_id = 'streak_7'
     and user_id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222');
  perform pg_temp.assert_eq(n, 2::bigint, 'both participants earned streak_7');

  select count(*) into n from public.user_badges where badge_id = 'streak_30';
  perform pg_temp.assert_eq(n, 0::bigint, 'streak_30 not awarded early');
end $$;

\echo ''
\echo '== deadline is the end of the day AFTER the last qualified day (§17) =='
do $$
declare s public.streaks;
begin
  select * into s from public.streaks where scope='direct';
  -- Last qualified 2026-03-07 in Asia/Riyadh -> deadline is 2026-03-09 00:00 +03.
  perform pg_temp.assert_eq(s.expires_at, '2026-03-09 00:00+03'::timestamptz, 'deadline = end of next local day');
  perform pg_temp.assert_eq(
    app_private.local_day(s.expires_at - interval '1 second', s.timezone),
    date '2026-03-08', 'the grace day is the following calendar day');
end $$;

\echo ''
\echo '== a missed day expires the streak and archives history (§18) =='
do $$
declare n integer; s public.streaks; h public.streak_history;
begin
  -- Sweep at a point past the deadline.
  n := app_private.expire_due_streaks('2026-03-09 00:00:01+03');
  perform pg_temp.assert_eq(n, 1, 'sweep expired one streak');

  select * into s from public.streaks where scope='direct';
  perform pg_temp.assert_eq(s.status, 'expired'::public.streak_status, 'status expired');
  perform pg_temp.assert_eq(s.current_length, 0, 'current length cleared');
  perform pg_temp.assert_eq(s.longest_length, 7, 'longest length retained');

  select * into h from public.streak_history where streak_id = s.id order by created_at desc limit 1;
  perform pg_temp.assert_eq(h.length, 7, 'history keeps the 7 day run');
  perform pg_temp.assert_eq(h.ended_reason, 'expired', 'history reason');
end $$;

\echo ''
\echo '== streak data is never destroyed by expiry =='
do $$
declare n bigint;
begin
  select count(*) into n from public.streaks where scope='direct';
  perform pg_temp.assert_eq(n, 1::bigint, 'streak row survives expiry');
  select count(*) into n from public.streak_events;
  perform pg_temp.assert_eq((n > 0), true, 'ledger survives expiry');
end $$;

\echo ''
\echo '== restarting after a lapse begins again at pending, not at the old count =='
do $$
declare s public.streaks; sid uuid; d timestamptz := '2026-03-20 12:00+03';
begin
  select id into sid from public.streaks where scope='direct';
  s := app_private.record_streak_activity(sid, '11111111-1111-1111-1111-111111111111', 'direct_message', null, d);
  s := app_private.record_streak_activity(sid, '22222222-2222-2222-2222-222222222222', 'direct_message', null, d);
  perform pg_temp.assert_eq(s.status, 'pending'::public.streak_status, 'restart: pending');
  perform pg_temp.assert_eq(s.current_length, 0, 'restart: length 0');
  perform pg_temp.assert_eq(s.longest_length, 7, 'restart: longest preserved');
end $$;

\echo ''
\echo '== a non-participant cannot contribute (§32) =='
do $$
declare sid uuid;
begin
  select id into sid from public.streaks where scope='direct';
  perform pg_temp.assert_raises(
    format('select app_private.record_streak_activity(%L, %L)', sid, '33333333-3333-3333-3333-333333333333'),
    'outsider rejected');
end $$;

\echo ''
\echo '== the pair row is canonical: order of arguments does not matter =='
do $$
declare s1 public.streaks; s2 public.streaks;
begin
  s1 := app_private.ensure_direct_streak('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222');
  s2 := app_private.ensure_direct_streak('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111');
  perform pg_temp.assert_eq(s1.id, s2.id, 'same streak row either way round');
end $$;

\echo ''
\echo '== a "1 day streak" is unrepresentable (§14) =='
do $$
declare sid uuid;
begin
  select id into sid from public.streaks where scope='direct';
  perform pg_temp.assert_raises(
    format('update public.streaks set current_length = 1 where id = %L', sid),
    'check constraint forbids length 1');
end $$;

\echo ''
\echo '== cross-timezone pair uses one agreed day boundary (§34) =='
do $$
declare s public.streaks;
begin
  -- Aisha (Asia/Riyadh) starts with Carim (America/New_York).
  s := app_private.ensure_direct_streak('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333');
  perform pg_temp.assert_eq(s.timezone, 'Asia/Riyadh', 'streak anchors to the initiator timezone');

  -- 2026-04-01 23:00 in Riyadh is still 2026-04-01 for the pair, though it is
  -- 16:00 on 2026-04-01 in New York.
  s := app_private.record_streak_activity(s.id, '11111111-1111-1111-1111-111111111111', 'direct_message', null, '2026-04-01 23:00+03');
  s := app_private.record_streak_activity(s.id, '33333333-3333-3333-3333-333333333333', 'direct_message', null, '2026-04-01 23:30+03');
  perform pg_temp.assert_eq(s.last_qualified_on, date '2026-04-01', 'shared day resolved in the streak timezone');

  -- 30 minutes later it is 2026-04-02 in Riyadh: a new day for the pair.
  s := app_private.record_streak_activity(s.id, '11111111-1111-1111-1111-111111111111', 'direct_message', null, '2026-04-02 00:10+03');
  s := app_private.record_streak_activity(s.id, '33333333-3333-3333-3333-333333333333', 'direct_message', null, '2026-04-02 00:20+03');
  perform pg_temp.assert_eq(s.current_length, 2, 'crossing local midnight advances the streak');
end $$;

\echo ''
\echo '== expiring-soon feed only nags the side that has not shown up (§17/§28) =='
do $$
declare n bigint;
begin
  -- Reset to a live streak whose deadline is a few hours out.
  update public.streaks
     set status = 'active', current_length = 5, longest_length = 7,
         last_qualified_on = (now() at time zone 'Asia/Riyadh')::date - 1,
         expires_at = now() + interval '3 hours',
         pending_day = null, pending_low_done = false, pending_high_done = false
   where scope = 'direct' and user_low = '11111111-1111-1111-1111-111111111111'
     and user_high = '22222222-2222-2222-2222-222222222222';
  delete from public.streak_events
   where streak_id in (select id from public.streaks where scope='direct')
     and local_day = (now() at time zone 'Asia/Riyadh')::date;

  select count(*) into n from app_private.streaks_expiring_within(interval '6 hours')
   where streak_id in (select id from public.streaks where user_low='11111111-1111-1111-1111-111111111111'
                         and user_high='22222222-2222-2222-2222-222222222222');
  perform pg_temp.assert_eq(n, 2::bigint, 'both sides need reminding');

  -- Aisha shows up today.
  insert into public.streak_events (streak_id, user_id, local_day, source)
  select id, '11111111-1111-1111-1111-111111111111', (now() at time zone 'Asia/Riyadh')::date, 'direct_message'
    from public.streaks where user_low='11111111-1111-1111-1111-111111111111'
      and user_high='22222222-2222-2222-2222-222222222222';

  select count(*) into n from app_private.streaks_expiring_within(interval '6 hours')
   where streak_id in (select id from public.streaks where user_low='11111111-1111-1111-1111-111111111111'
                         and user_high='22222222-2222-2222-2222-222222222222');
  perform pg_temp.assert_eq(n, 1::bigint, 'only the silent side is reminded');
end $$;

rollback;

\echo ''
\echo '=== streak engine: all assertions passed ==='
