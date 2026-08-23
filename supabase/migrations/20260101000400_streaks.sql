-- ============================================================================
-- Uni Streak :: 0004 streak tables
-- ============================================================================
-- Model notes (§14-19):
--
--  * A direct streak is between an unordered PAIR of users. We store the pair
--    canonically (user_low < user_high) with a unique index, so there is
--    exactly one row per pair and concurrent first-messages cannot fork it.
--
--  * A streak day is a *calendar day in the participant's own timezone* (§34).
--    Two users in different zones can be on different local dates; the day
--    only counts when BOTH have contributed within their own local day.
--    We anchor the shared day to the pair's "streak timezone" - the timezone
--    of the user who started the streak - so the pair always agrees on which
--    day is being filled. Each user's countdown is then rendered in their own
--    zone from that shared deadline.
--
--  * `current_length` follows the spec exactly: day 1 does NOT display as a
--    streak (status 'pending', length 0). When both users qualify again on the
--    next calendar day the streak becomes 2, then 3, ... (§14).
-- ============================================================================

create table public.streaks (
  id             uuid primary key default gen_random_uuid(),
  scope          public.streak_scope not null default 'direct',

  -- Direct streaks: canonical ordered pair.
  user_low       uuid references public.profiles (id) on delete cascade,
  user_high      uuid references public.profiles (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,

  -- University streaks (§19).
  university_id  uuid references public.universities (id) on delete cascade,

  status         public.streak_status not null default 'pending',
  /* 0 while pending; >= 2 once counted. Never 1 - see the module comment. */
  current_length integer not null default 0,
  longest_length integer not null default 0,

  /* The local calendar date (in `timezone`) of the most recent fully
     qualified day. */
  last_qualified_on date,
  /* Which side has contributed on `pending_day`. Reset when the day flips. */
  pending_day       date,
  pending_low_done  boolean not null default false,
  pending_high_done boolean not null default false,

  /* Shared timezone anchoring this streak's day boundaries. */
  timezone       text not null default 'UTC',
  /* Instant the streak lapses if the day is not completed. Maintained by the
     engine; the client renders a countdown to it in local time (§17). */
  expires_at     timestamptz,

  started_on     date,
  expired_at     timestamptz,
  restored_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint streaks_direct_shape check (
    (scope = 'direct'
      and user_low is not null and user_high is not null
      and university_id is null and user_low < user_high)
    or
    (scope = 'university'
      and university_id is not null
      and user_low is null and user_high is null)
  ),
  constraint streaks_length_nonneg check (current_length >= 0 and longest_length >= 0),
  -- A counted streak is never exactly 1 day (§14: day one is "pending").
  constraint streaks_no_one_day check (current_length <> 1),
  constraint streaks_longest_ge_current check (longest_length >= current_length)
);

create unique index streaks_direct_pair_key on public.streaks (user_low, user_high)
  where scope = 'direct';
create unique index streaks_university_key on public.streaks (university_id)
  where scope = 'university';
create index streaks_expiry_idx on public.streaks (expires_at)
  where status in ('pending', 'active', 'restored');
create index streaks_user_low_idx on public.streaks (user_low, current_length desc)
  where scope = 'direct';
create index streaks_user_high_idx on public.streaks (user_high, current_length desc)
  where scope = 'direct';

create trigger streaks_touch before update on public.streaks
  for each row execute function app_private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- streak_events
-- ---------------------------------------------------------------------------
-- Append-only ledger of qualifying activity. The unique index is the
-- anti-abuse spine: one contribution per user, per streak, per local day,
-- no matter how many messages they send (§15).
create table public.streak_events (
  id           uuid primary key default gen_random_uuid(),
  streak_id    uuid not null references public.streaks (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  /* Local calendar date, in the streak's timezone. */
  local_day    date not null,
  /* What produced this event, for auditing and abuse review. */
  source       text not null default 'direct_message',
  message_id   uuid references public.messages (id) on delete set null,
  created_at   timestamptz not null default now(),

  constraint streak_events_source_allowed check (
    source in ('direct_message', 'streak_media', 'group_interaction', 'restore')
  )
);

create unique index streak_events_one_per_day
  on public.streak_events (streak_id, user_id, local_day);
create index streak_events_streak_idx on public.streak_events (streak_id, local_day desc);

-- ---------------------------------------------------------------------------
-- streak_history  (§18: never silently delete streak data)
-- ---------------------------------------------------------------------------
create table public.streak_history (
  id          uuid primary key default gen_random_uuid(),
  streak_id   uuid not null references public.streaks (id) on delete cascade,
  length      integer not null,
  started_on  date,
  ended_on    date not null,
  ended_reason text not null default 'expired',
  created_at  timestamptz not null default now(),

  constraint streak_history_length_positive check (length > 0),
  constraint streak_history_reason_allowed check (
    ended_reason in ('expired', 'blocked', 'account_deleted', 'moderation')
  )
);

create index streak_history_streak_idx on public.streak_history (streak_id, ended_on desc);

-- ---------------------------------------------------------------------------
-- university_activity  (§19 rollup that drives the university streak)
-- ---------------------------------------------------------------------------
create table public.university_activity (
  university_id uuid not null references public.universities (id) on delete cascade,
  local_day     date not null,
  active_users  integer not null default 0,
  post_count    integer not null default 0,
  message_count integer not null default 0,
  reaction_count integer not null default 0,
  /* Snapshot of the threshold in force that day, so history stays truthful
     if an admin later changes the setting. */
  threshold_applied integer,
  met_threshold boolean not null default false,
  updated_at    timestamptz not null default now(),

  primary key (university_id, local_day)
);

create index university_activity_day_idx on public.university_activity (local_day desc);

-- Distinct daily actives, so `active_users` is a real count rather than a
-- sum of actions.
create table public.university_daily_actives (
  university_id uuid not null references public.universities (id) on delete cascade,
  local_day     date not null,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  primary key (university_id, local_day, user_id)
);
