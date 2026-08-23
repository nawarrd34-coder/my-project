-- ============================================================================
-- Uni Streak :: 0008 the streak engine
-- ============================================================================
-- This is the only place in the system that mutates streak state (§33). The
-- client never computes a streak; it reads one.
--
-- Design:
--
--  * `app_private.local_day(ts, tz)` converts an instant to a calendar date in
--    a named timezone. Every day decision in the engine goes through it, so
--    there is exactly one definition of "what day is it" (§34).
--
--  * `record_streak_activity` is the single entry point. It is idempotent per
--    (streak, user, local day) via a unique index, which is what stops message
--    spam from inflating a streak (§15).
--
--  * A day counts only when BOTH participants contributed during it. The row
--    tracks the in-progress day in `pending_day` / `pending_*_done`.
--
--  * Progression follows §14 exactly:
--        first completed day  -> status 'pending', current_length 0
--        next consecutive day -> status 'active',  current_length 2
--        each further day     -> current_length + 1
--    A `current_length <> 1` check constraint makes the "never show 1" rule
--    unrepresentable rather than merely unimplemented.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Day arithmetic
-- ---------------------------------------------------------------------------

create or replace function app_private.local_day(ts timestamptz, tz text)
returns date
language sql
immutable
strict
as $$
  select (ts at time zone tz)::date;
$$;

/* The instant at which `day` ends in `tz` - i.e. local midnight of the next
   day. This is the streak deadline the countdown ticks down to (§17). */
create or replace function app_private.end_of_local_day(day date, tz text)
returns timestamptz
language sql
immutable
strict
as $$
  select ((day + 1)::timestamp) at time zone tz;
$$;

comment on function app_private.local_day(timestamptz, text) is
  'Single definition of "which calendar day is it" for a given timezone (§34).';

-- ---------------------------------------------------------------------------
-- Pair helpers
-- ---------------------------------------------------------------------------

/* Find or create the direct streak row for an unordered pair. The unique
   index on (user_low, user_high) plus ON CONFLICT makes this safe when both
   users message for the first time simultaneously. */
create or replace function app_private.ensure_direct_streak(
  a uuid,
  b uuid,
  conversation uuid default null
)
returns public.streaks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  lo uuid := least(a, b);
  hi uuid := greatest(a, b);
  tz text;
  result public.streaks;
begin
  if a = b then
    raise exception 'a streak needs two different people' using errcode = '22023';
  end if;

  -- Anchor the pair's day boundaries to the initiator's timezone, so both
  -- sides agree on which day is being filled even across zones.
  select coalesce(p.timezone, 'UTC') into tz from public.profiles p where p.id = a;

  insert into public.streaks (scope, user_low, user_high, conversation_id, timezone, status)
  values ('direct', lo, hi, conversation, coalesce(tz, 'UTC'), 'pending')
  on conflict (user_low, user_high) where scope = 'direct'
  do update set conversation_id = coalesce(public.streaks.conversation_id, excluded.conversation_id)
  returning * into result;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- The core transition
-- ---------------------------------------------------------------------------

/*
  Record one qualifying contribution and advance the streak if that completes
  a day.

  Returns the streak row after the transition.

  Concurrency: the row is locked FOR UPDATE before any read of its counters,
  so two simultaneous messages from the two participants serialise instead of
  both reading a stale `pending_*_done`.
*/
create or replace function app_private.record_streak_activity(
  p_streak_id uuid,
  p_actor uuid,
  p_source text default 'direct_message',
  p_message uuid default null,
  p_at_time timestamptz default now()
)
returns public.streaks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s public.streaks;
  today date;
  other_done boolean;
  actor_is_low boolean;
  is_new_event boolean;
  gap integer;
  new_length integer;
begin
  select * into s from public.streaks where id = p_streak_id for update;
  if not found then
    raise exception 'streak % not found', p_streak_id using errcode = 'P0002';
  end if;

  if s.scope <> 'direct' then
    raise exception 'record_streak_activity only handles direct streaks'
      using errcode = '22023';
  end if;

  if p_actor not in (s.user_low, s.user_high) then
    raise exception 'user % is not part of streak %', p_actor, p_streak_id
      using errcode = '42501';
  end if;

  today := app_private.local_day(p_at_time, s.timezone);
  actor_is_low := (p_actor = s.user_low);

  -- Ledger insert. The unique index makes repeat activity on the same day a
  -- no-op, which is the anti-abuse guarantee (§15).
  insert into public.streak_events as e (streak_id, user_id, local_day, source, message_id)
  values (p_streak_id, p_actor, today, p_source, p_message)
  on conflict (streak_id, user_id, local_day) do nothing;

  is_new_event := found;

  -- Roll the in-progress day forward if the calendar has moved on.
  if s.pending_day is distinct from today then
    s.pending_day := today;
    s.pending_low_done := false;
    s.pending_high_done := false;
  end if;

  if actor_is_low then
    s.pending_low_done := true;
    other_done := s.pending_high_done;
  else
    s.pending_high_done := true;
    other_done := s.pending_low_done;
  end if;

  -- Both sides have now contributed today -> the day is complete.
  if other_done and s.last_qualified_on is distinct from today then
    if s.last_qualified_on is null then
      -- Very first completed day: pending, and explicitly NOT "1 day" (§14).
      s.status := 'pending';
      s.current_length := 0;
      s.started_on := today;
    else
      gap := today - s.last_qualified_on;
      if gap = 1 then
        -- Consecutive day. From pending the streak becomes 2, not 1 (§14).
        new_length := case when s.current_length = 0 then 2 else s.current_length + 1 end;
        s.current_length := new_length;
        s.status := 'active';
      elsif gap <= 0 then
        -- Clock skew or a backdated write; ignore rather than corrupt state.
        null;
      else
        -- A day was missed. The sweep should already have expired this row;
        -- if we get here (e.g. the sweep is behind), close the old run and
        -- start a fresh one from today.
        if s.current_length >= 2 then
          insert into public.streak_history (streak_id, length, started_on, ended_on, ended_reason)
          values (s.id, s.current_length, s.started_on, s.last_qualified_on, 'expired');
        end if;
        s.current_length := 0;
        s.status := 'pending';
        s.started_on := today;
      end if;
    end if;

    s.last_qualified_on := today;
    s.longest_length := greatest(s.longest_length, s.current_length);
  end if;

  -- The deadline is always the end of the *next* day after the last complete
  -- one: you have all of today to keep a streak that last qualified yesterday.
  s.expires_at := app_private.end_of_local_day(
    coalesce(s.last_qualified_on, today) + 1, s.timezone
  );

  update public.streaks set
    status            = s.status,
    current_length    = s.current_length,
    longest_length    = s.longest_length,
    last_qualified_on = s.last_qualified_on,
    pending_day       = s.pending_day,
    pending_low_done  = s.pending_low_done,
    pending_high_done = s.pending_high_done,
    started_on        = s.started_on,
    expires_at        = s.expires_at,
    expired_at        = null
  where id = s.id
  returning * into s;

  -- Mark the message that actually counted, for the UI.
  if is_new_event and p_message is not null then
    update public.messages set counted_for_streak = true where id = p_message;
  end if;

  -- Personal-best bookkeeping and milestone badges.
  if s.current_length > 0 then
    update public.profiles
       set longest_streak = greatest(longest_streak, s.current_length)
     where id in (s.user_low, s.user_high);

    perform app_private.award_streak_badges(s.user_low, s.current_length, s.id);
    perform app_private.award_streak_badges(s.user_high, s.current_length, s.id);
  end if;

  return s;
end;
$$;

-- ---------------------------------------------------------------------------
-- Badges (§26) - awarded by the engine, never by the client.
-- ---------------------------------------------------------------------------

create or replace function app_private.award_streak_badges(
  target_user uuid,
  streak_length integer,
  source uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.user_badges (user_id, badge_id, source_id)
  select target_user, b.id, source
    from public.badges b
   where b.is_active
     and b.rule_kind = 'streak_length'
     and b.rule_value is not null
     and streak_length >= b.rule_value
  on conflict (user_id, badge_id) do nothing;

  -- Notify for anything newly earned in this statement.
  insert into public.notifications (user_id, kind, title_key, params, link)
  select ub.user_id, 'badge_earned', 'notifications.badgeEarned',
         jsonb_build_object('badge', b.name_key), '/profile/badges'
    from public.user_badges ub
    join public.badges b on b.id = ub.badge_id
   where ub.user_id = target_user
     and ub.earned_at > now() - interval '2 seconds'
     and b.rule_kind = 'streak_length';
end;
$$;

-- ---------------------------------------------------------------------------
-- Expiry sweep (§18) - run on a schedule; never deletes history.
-- ---------------------------------------------------------------------------

/*
  Expire every direct streak whose deadline has passed.

  A streak survives as a row: status becomes 'expired' and, if it had counted
  days, the run is archived into streak_history so the UI can still say
  "83 day streak ended" (§18).

  Returns the number of streaks expired.
*/
create or replace function app_private.expire_due_streaks(at_time timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  expired_count integer := 0;
  r record;
begin
  for r in
    select * from public.streaks
     where scope = 'direct'
       and status in ('pending', 'active', 'restored')
       and expires_at is not null
       and expires_at <= at_time
     for update skip locked
  loop
    if r.current_length >= 2 then
      insert into public.streak_history (streak_id, length, started_on, ended_on, ended_reason)
      values (r.id, r.current_length, r.started_on, r.last_qualified_on, 'expired');
    end if;

    update public.streaks
       set status = 'expired',
           current_length = 0,
           expired_at = at_time,
           pending_day = null,
           pending_low_done = false,
           pending_high_done = false
     where id = r.id;

    expired_count := expired_count + 1;
  end loop;

  return expired_count;
end;
$$;

/*
  Streaks that are still alive but will lapse within `within`. Drives both the
  "Expiring soon" rail (§17) and the reminder push (§28).
*/
create or replace function app_private.streaks_expiring_within(within interval)
returns table (
  streak_id uuid,
  user_id uuid,
  partner_id uuid,
  current_length integer,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.id, u.user_id, u.partner_id, s.current_length, s.expires_at
    from public.streaks s
    cross join lateral (
      values (s.user_low, s.user_high), (s.user_high, s.user_low)
    ) as u(user_id, partner_id)
   where s.scope = 'direct'
     and s.status in ('pending', 'active', 'restored')
     and s.expires_at is not null
     and s.expires_at > now()
     and s.expires_at <= now() + within
     -- Only nag the side that has not yet contributed today.
     and not exists (
       select 1 from public.streak_events e
       where e.streak_id = s.id
         and e.user_id = u.user_id
         and e.local_day = app_private.local_day(now(), s.timezone)
     );
$$;

-- ---------------------------------------------------------------------------
-- Streak restore (§18: an explicit feature, not a silent forgiveness)
-- ---------------------------------------------------------------------------

create or replace function public.restore_streak(target_streak uuid)
returns public.streaks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s public.streaks;
  last_run public.streak_history;
  grace interval := interval '24 hours';
begin
  select * into s from public.streaks where id = target_streak for update;
  if not found then
    raise exception 'streak not found' using errcode = 'P0002';
  end if;

  if auth.uid() not in (s.user_low, s.user_high) then
    raise exception 'not your streak' using errcode = '42501';
  end if;

  if s.status <> 'expired' then
    raise exception 'streak is not expired' using errcode = '22023';
  end if;

  -- Restore is only offered briefly after the lapse, so it cannot be used to
  -- resurrect an abandoned streak weeks later.
  if s.expired_at is null or s.expired_at < now() - grace then
    raise exception 'restore window has closed' using errcode = '22023';
  end if;

  select * into last_run from public.streak_history
   where streak_id = s.id order by ended_on desc, created_at desc limit 1;

  if last_run.id is null then
    raise exception 'nothing to restore' using errcode = '22023';
  end if;

  update public.streaks
     set status = 'restored',
         current_length = last_run.length,
         longest_length = greatest(longest_length, last_run.length),
         last_qualified_on = app_private.local_day(now(), timezone) - 1,
         expires_at = app_private.end_of_local_day(app_private.local_day(now(), timezone), timezone),
         restored_at = now(),
         expired_at = null
   where id = s.id
  returning * into s;

  -- Record the restore in the ledger so the history reads honestly.
  insert into public.streak_events (streak_id, user_id, local_day, source)
  values (s.id, auth.uid(), app_private.local_day(now(), s.timezone), 'restore')
  on conflict do nothing;

  return s;
end;
$$;

revoke all on function public.restore_streak(uuid) from public, anon;
grant execute on function public.restore_streak(uuid) to authenticated;
