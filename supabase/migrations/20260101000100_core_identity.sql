-- ============================================================================
-- Uni Streak :: 0001 universities, profiles, membership, privacy
-- ============================================================================

-- ---------------------------------------------------------------------------
-- universities
-- ---------------------------------------------------------------------------
-- Adding a university is a row insert plus (optionally) channel rows. There is
-- no per-university code anywhere in the app (§1: must scale to hundreds).
create table public.universities (
  id               uuid primary key default gen_random_uuid(),
  code             text not null,                 -- 'KSU', 'PNU', 'IMAMU'
  name_en          text not null,
  name_ar          text not null,
  short_name_en    text not null,
  short_name_ar    text not null,
  country_code     char(2) not null default 'SA',
  /* Default IANA zone for the campus. Individual users still get their own
     zone; this is only the fallback for university-level rollups. */
  timezone         text not null default 'Asia/Riyadh',
  brand_color      text not null default '#FF5A1F',
  logo_url         text,
  /* Daily active-member count required to extend the university streak (§19).
     Admin-configurable per university. */
  streak_threshold integer not null default 50,
  is_active        boolean not null default true,
  member_count     integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint universities_code_format check (code ~ '^[A-Z][A-Z0-9_]{1,15}$'),
  constraint universities_threshold_positive check (streak_threshold > 0),
  constraint universities_brand_color_hex check (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint universities_member_count_nonneg check (member_count >= 0)
);

create unique index universities_code_key on public.universities (code);
create index universities_active_idx on public.universities (is_active) where is_active;
create index universities_name_trgm_idx on public.universities
  using gin (name_en extensions.gin_trgm_ops, name_ar extensions.gin_trgm_ops);

create trigger universities_touch before update on public.universities
  for each row execute function app_private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- profiles  (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  university_id      uuid not null references public.universities (id) on delete restrict,
  username           text not null,
  /* Lower-cased copy used for the uniqueness index and lookups, so we can
     preserve the user's chosen casing for display. */
  username_normalized text not null,
  display_name       text,
  avatar_url         text,
  /* Deterministic anonymous label suffix, e.g. "Anonymous #4821" (§24).
     Stable per user per university so a thread reads coherently, but it
     reveals nothing about identity. */
  anon_tag           integer not null,
  bio                text,
  role               public.app_role not null default 'student',
  /* IANA timezone, captured from the device. Drives every streak deadline
     and daily reset for this user (§34). */
  timezone           text not null default 'UTC',
  locale             text not null default 'en',
  default_identity   public.identity_mode not null default 'public',

  -- Privacy controls (§25)
  show_username        boolean not null default true,
  allow_direct_messages boolean not null default true,
  allow_group_invites  boolean not null default true,
  show_online_status   boolean not null default true,
  read_receipts        boolean not null default true,
  hide_from_leaderboard boolean not null default false,

  -- Denormalised counters, maintained by trigger (§31: avoid needless dupes,
  -- but these are hot-path aggregates that must not require a scan).
  post_count         integer not null default 0,
  message_count      integer not null default 0,
  longest_streak     integer not null default 0,

  last_active_at     timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  /* Soft delete: the row survives just long enough for the async purge job to
     detach content. See `public.delete_my_account`. */
  deleted_at         timestamptz,

  constraint profiles_username_format check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  constraint profiles_bio_length check (bio is null or char_length(bio) <= 200),
  constraint profiles_display_name_length check (display_name is null or char_length(display_name) <= 40),
  constraint profiles_anon_tag_range check (anon_tag between 1000 and 9999),
  constraint profiles_counters_nonneg check (post_count >= 0 and message_count >= 0 and longest_streak >= 0)
);

create unique index profiles_username_normalized_key
  on public.profiles (username_normalized);
create index profiles_university_idx on public.profiles (university_id)
  where deleted_at is null;
create index profiles_username_trgm_idx on public.profiles
  using gin (username_normalized extensions.gin_trgm_ops);
create index profiles_last_active_idx on public.profiles (university_id, last_active_at desc)
  where deleted_at is null;

create trigger profiles_touch before update on public.profiles
  for each row execute function app_private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- university_members
-- ---------------------------------------------------------------------------
-- A user has exactly one *home* university (profiles.university_id) but the
-- join table lets us model transfers and future multi-campus membership
-- without a schema change.
create table public.university_members (
  university_id uuid not null references public.universities (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  is_primary    boolean not null default true,
  joined_at     timestamptz not null default now(),
  primary key (university_id, user_id)
);

create index university_members_user_idx on public.university_members (user_id);
-- At most one primary university per user.
create unique index university_members_one_primary
  on public.university_members (user_id) where is_primary;

-- ---------------------------------------------------------------------------
-- blocks  (§29)
-- ---------------------------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

-- ---------------------------------------------------------------------------
-- bans  (§29)
-- ---------------------------------------------------------------------------
create table public.bans (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  scope         public.ban_scope not null default 'platform',
  university_id uuid references public.universities (id) on delete cascade,
  reason        text not null,
  issued_by     uuid references public.profiles (id) on delete set null,
  /* null = permanent */
  expires_at    timestamptz,
  lifted_at     timestamptz,
  created_at    timestamptz not null default now(),

  constraint bans_university_scope check (
    (scope = 'university' and university_id is not null)
    or (scope = 'platform' and university_id is null)
  )
);

-- One live ban per user per scope; partial index keeps history queryable.
create unique index bans_active_platform_key on public.bans (user_id)
  where scope = 'platform' and lifted_at is null;
create index bans_user_idx on public.bans (user_id) where lifted_at is null;
create index bans_expiry_idx on public.bans (expires_at) where lifted_at is null;

comment on table public.bans is
  'Bans key on the authenticated user id, so anonymous content is covered too (§24).';
