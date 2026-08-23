-- ============================================================================
-- Uni Streak :: 0005 daily questions, badges, notifications, reports, admin
-- ============================================================================

-- ---------------------------------------------------------------------------
-- daily_questions  (§21)
-- ---------------------------------------------------------------------------
create table public.daily_questions (
  id            uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities (id) on delete cascade,
  /* The local date this question is "for", in the university's timezone. */
  local_day     date not null,
  question_en   text not null,
  question_ar   text not null,
  created_by    uuid references public.profiles (id) on delete set null,
  vote_count    integer not null default 0,
  closes_at     timestamptz not null,
  created_at    timestamptz not null default now(),

  constraint daily_questions_text_length check (
    char_length(btrim(question_en)) between 1 and 160
    and char_length(btrim(question_ar)) between 1 and 160
  )
);

create unique index daily_questions_university_day_key
  on public.daily_questions (university_id, local_day);

create table public.daily_question_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.daily_questions (id) on delete cascade,
  label_en    text not null,
  label_ar    text not null,
  position    smallint not null,
  vote_count  integer not null default 0,

  constraint dq_options_position_range check (position between 0 and 5)
);

create unique index dq_options_question_position_key
  on public.daily_question_options (question_id, position);

create table public.daily_question_answers (
  question_id uuid not null references public.daily_questions (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  option_id   uuid not null references public.daily_question_options (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (question_id, user_id)
);

create index dq_answers_option_idx on public.daily_question_answers (option_id);

-- ---------------------------------------------------------------------------
-- badges  (§26)
-- ---------------------------------------------------------------------------
create table public.badges (
  id          text primary key,          -- 'streak_7', 'first_week'
  emoji       text not null,
  /* i18n key rather than literal text, so badge names localize (§4). */
  name_key    text not null,
  /* Machine-readable unlock rule, evaluated server-side. */
  rule_kind   text not null,
  rule_value  integer,
  sort_order  integer not null default 100,
  is_active   boolean not null default true,

  constraint badges_rule_kind_allowed check (
    rule_kind in ('streak_length', 'university_streak_length', 'message_count',
                  'post_count', 'days_since_join', 'manual')
  )
);

create table public.user_badges (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  badge_id   text not null references public.badges (id) on delete cascade,
  earned_at  timestamptz not null default now(),
  /* Context, e.g. which streak earned it. */
  source_id  uuid,
  primary key (user_id, badge_id)
);

create index user_badges_user_idx on public.user_badges (user_id, earned_at desc);

-- ---------------------------------------------------------------------------
-- notifications  (§28)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        public.notification_kind not null,
  /* i18n key + params, resolved on the device so the notification respects
     the reader's language rather than the sender's (§4). */
  title_key   text not null,
  body_key    text,
  params      jsonb not null default '{}'::jsonb,
  /* Deep link target, e.g. /chat/<id>. */
  link        text,
  actor_id    uuid references public.profiles (id) on delete set null,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id)
  where read_at is null;

-- Per-user notification switches (§28 "users must be able to customize").
create table public.notification_settings (
  user_id            uuid primary key references public.profiles (id) on delete cascade,
  streaks            boolean not null default true,
  messages           boolean not null default true,
  reactions          boolean not null default true,
  comments           boolean not null default true,
  daily_question     boolean not null default true,
  university_activity boolean not null default false,
  /* Quiet hours in the user's local timezone, as minutes past midnight. */
  quiet_from_minute  smallint,
  quiet_to_minute    smallint,
  updated_at         timestamptz not null default now()
);

-- Expo push tokens. One row per device.
create table public.push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  token      text not null,
  platform   text not null,
  device_id  text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint push_tokens_platform_allowed check (platform in ('ios', 'android', 'web'))
);

create unique index push_tokens_token_key on public.push_tokens (token);
create index push_tokens_user_idx on public.push_tokens (user_id);

-- ---------------------------------------------------------------------------
-- reports  (§29)
-- ---------------------------------------------------------------------------
create table public.reports (
  id             uuid primary key default gen_random_uuid(),
  reporter_id    uuid not null references public.profiles (id) on delete cascade,
  target         public.report_target not null,
  /* Exactly one of these is set, matching `target`. */
  post_id        uuid references public.posts (id) on delete cascade,
  comment_id     uuid references public.comments (id) on delete cascade,
  message_id     uuid references public.messages (id) on delete cascade,
  reported_user_id uuid references public.profiles (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete cascade,

  university_id  uuid references public.universities (id) on delete set null,
  reason         public.report_reason not null,
  details        text,
  status         public.report_status not null default 'open',
  resolved_by    uuid references public.profiles (id) on delete set null,
  resolution_note text,
  resolved_at    timestamptz,
  created_at     timestamptz not null default now(),

  constraint reports_details_length check (details is null or char_length(details) <= 1000),
  constraint reports_target_matches check (
    (target = 'post'    and post_id is not null)
    or (target = 'comment' and comment_id is not null)
    or (target = 'message' and message_id is not null)
    or (target = 'user'    and reported_user_id is not null)
    or (target = 'group'   and conversation_id is not null)
  )
);

create index reports_status_idx on public.reports (status, created_at desc);
create index reports_university_idx on public.reports (university_id, status);
-- One open report per reporter per post, to blunt report-brigading.
create unique index reports_dedupe_post on public.reports (reporter_id, post_id)
  where post_id is not null and status = 'open';

-- ---------------------------------------------------------------------------
-- admin_actions  (§30 audit trail)
-- ---------------------------------------------------------------------------
create table public.admin_actions (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid not null references public.profiles (id) on delete set null,
  action      public.moderation_action not null,
  target_type text,
  target_id   uuid,
  university_id uuid references public.universities (id) on delete set null,
  note        text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index admin_actions_admin_idx on public.admin_actions (admin_id, created_at desc);
create index admin_actions_target_idx on public.admin_actions (target_type, target_id);

-- ---------------------------------------------------------------------------
-- rate_limits  (§29 anti-spam, enforced server-side)
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  bucket      text not null,       -- 'post', 'message', 'report', 'reaction'
  window_start timestamptz not null,
  count       integer not null default 0,
  primary key (user_id, bucket, window_start)
);

create index rate_limits_window_idx on public.rate_limits (window_start);

-- ---------------------------------------------------------------------------
-- app_settings  (§31 settings table; global knobs)
-- ---------------------------------------------------------------------------
create table public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
