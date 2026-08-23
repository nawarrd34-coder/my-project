-- ============================================================================
-- Uni Streak :: 0002 channels, posts, media, comments, reactions, polls, sounds
-- ============================================================================

-- ---------------------------------------------------------------------------
-- channels  (§9)
-- ---------------------------------------------------------------------------
create table public.channels (
  id            uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities (id) on delete cascade,
  slug          text not null,        -- 'general', 'study', 'memes'
  name_en       text not null,
  name_ar       text not null,
  description_en text,
  description_ar text,
  icon          text not null default 'chatbubbles',
  sort_order    integer not null default 100,
  /* Read-only channels let admins run announcement feeds. */
  is_read_only  boolean not null default false,
  is_active     boolean not null default true,
  post_count    integer not null default 0,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint channels_slug_format check (slug ~ '^[a-z][a-z0-9_-]{1,30}$')
);

create unique index channels_university_slug_key
  on public.channels (university_id, slug);
create index channels_university_idx on public.channels (university_id, sort_order)
  where is_active;

create trigger channels_touch before update on public.channels
  for each row execute function app_private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- sounds  (§23)
-- ---------------------------------------------------------------------------
create table public.sounds (
  id            uuid primary key default gen_random_uuid(),
  university_id uuid references public.universities (id) on delete cascade,
  uploader_id   uuid references public.profiles (id) on delete set null,
  title         text not null,
  storage_path  text not null,
  duration_ms   integer not null,
  use_count     integer not null default 0,
  is_approved   boolean not null default false,
  is_removed    boolean not null default false,
  created_at    timestamptz not null default now(),

  -- Hard cap enforced in the database, not just the client (§23 storage limits)
  constraint sounds_duration_range check (duration_ms between 500 and 30000),
  constraint sounds_title_length check (char_length(title) between 1 and 60)
);

create index sounds_trending_idx on public.sounds (university_id, use_count desc)
  where is_approved and not is_removed;

-- ---------------------------------------------------------------------------
-- posts  (§10)
-- ---------------------------------------------------------------------------
create table public.posts (
  id            uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities (id) on delete cascade,
  channel_id    uuid references public.channels (id) on delete set null,
  /* ALWAYS the real authenticated author, even for anonymous posts. Identity
     hiding happens at read time (§24) so moderation and bans keep working. */
  author_id     uuid not null references public.profiles (id) on delete cascade,
  identity_mode public.identity_mode not null default 'public',
  kind          public.post_kind not null default 'text',
  body          text,
  sound_id      uuid references public.sounds (id) on delete set null,

  -- Aggregates maintained by trigger; reading a feed must never aggregate.
  comment_count  integer not null default 0,
  reaction_count integer not null default 0,
  /* Time-decayed score for the trending rail, refreshed by the pulse job. */
  hot_score      double precision not null default 0,

  is_pinned     boolean not null default false,
  edited_at     timestamptz,
  /* Moderator removal. Distinct from author deletion so we can restore. */
  removed_at    timestamptz,
  removed_by    uuid references public.profiles (id) on delete set null,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint posts_body_length check (body is null or char_length(body) <= 2000),
  -- A text post must actually say something.
  constraint posts_text_has_body check (kind <> 'text' or coalesce(char_length(btrim(body)), 0) > 0),
  constraint posts_sound_kind check (kind <> 'sound' or sound_id is not null),
  constraint posts_counters_nonneg check (comment_count >= 0 and reaction_count >= 0)
);

-- The feed query: university + not deleted + newest first.
create index posts_feed_idx on public.posts (university_id, created_at desc)
  where deleted_at is null and removed_at is null;
create index posts_channel_idx on public.posts (channel_id, created_at desc)
  where deleted_at is null and removed_at is null;
create index posts_author_idx on public.posts (author_id, created_at desc)
  where deleted_at is null;
create index posts_hot_idx on public.posts (university_id, hot_score desc)
  where deleted_at is null and removed_at is null;
create index posts_body_trgm_idx on public.posts
  using gin (body extensions.gin_trgm_ops) where deleted_at is null;

create trigger posts_touch before update on public.posts
  for each row execute function app_private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- post_media
-- ---------------------------------------------------------------------------
create table public.post_media (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.posts (id) on delete cascade,
  kind         public.media_kind not null,
  storage_path text not null,
  width        integer,
  height       integer,
  duration_ms  integer,
  /* Tiny base64 placeholder so the feed never flashes an empty box (§35). */
  blurhash     text,
  position     smallint not null default 0,
  created_at   timestamptz not null default now(),

  constraint post_media_position_range check (position between 0 and 9),
  constraint post_media_video_duration check (
    kind <> 'video' or (duration_ms is not null and duration_ms <= 60000)
  )
);

create index post_media_post_idx on public.post_media (post_id, position);

-- ---------------------------------------------------------------------------
-- comments  (§10)
-- ---------------------------------------------------------------------------
create table public.comments (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references public.posts (id) on delete cascade,
  author_id     uuid not null references public.profiles (id) on delete cascade,
  /* One level of threading: a reply points at a top-level comment. */
  parent_id     uuid references public.comments (id) on delete cascade,
  identity_mode public.identity_mode not null default 'public',
  body          text not null,
  reaction_count integer not null default 0,
  edited_at     timestamptz,
  removed_at    timestamptz,
  removed_by    uuid references public.profiles (id) on delete set null,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint comments_body_length check (char_length(btrim(body)) between 1 and 1000)
);

create index comments_post_idx on public.comments (post_id, created_at)
  where deleted_at is null and removed_at is null;
create index comments_parent_idx on public.comments (parent_id, created_at)
  where parent_id is not null;
create index comments_author_idx on public.comments (author_id, created_at desc);

create trigger comments_touch before update on public.comments
  for each row execute function app_private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- reactions  (§11)
-- ---------------------------------------------------------------------------
-- One table for posts and comments, with an XOR constraint. A user may hold
-- at most one reaction per target (picking a new emoji replaces the old one).
create table public.reactions (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  emoji      text not null,
  created_at timestamptz not null default now(),

  constraint reactions_one_target check (
    (post_id is not null and comment_id is null)
    or (post_id is null and comment_id is not null)
  ),
  -- Allow-list, so the client cannot invent reaction types (§32).
  constraint reactions_allowed_emoji check (
    emoji in ('❤️', '😂', '😭', '🔥', '💀', '👀', '🫡', '🤡')
  )
);

create unique index reactions_one_per_post
  on public.reactions (post_id, user_id) where post_id is not null;
create unique index reactions_one_per_comment
  on public.reactions (comment_id, user_id) where comment_id is not null;
create index reactions_post_emoji_idx on public.reactions (post_id, emoji);

-- ---------------------------------------------------------------------------
-- saved_posts  (§10 "Save")
-- ---------------------------------------------------------------------------
create table public.saved_posts (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  post_id    uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

-- ---------------------------------------------------------------------------
-- polls  (§10 poll posts)
-- ---------------------------------------------------------------------------
create table public.poll_options (
  id       uuid primary key default gen_random_uuid(),
  post_id  uuid not null references public.posts (id) on delete cascade,
  label    text not null,
  position smallint not null,
  vote_count integer not null default 0,

  constraint poll_options_label_length check (char_length(btrim(label)) between 1 and 80),
  constraint poll_options_position_range check (position between 0 and 5)
);

create unique index poll_options_post_position_key on public.poll_options (post_id, position);

create table public.poll_votes (
  post_id    uuid not null references public.posts (id) on delete cascade,
  option_id  uuid not null references public.poll_options (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- One vote per user per poll, enforced by the primary key shape.
  primary key (post_id, user_id)
);

create index poll_votes_option_idx on public.poll_votes (option_id);
