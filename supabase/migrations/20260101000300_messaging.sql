-- ============================================================================
-- Uni Streak :: 0003 conversations, membership, messages, receipts
-- ============================================================================
-- Direct chats and group chats share one table pair. A direct conversation is
-- a conversation with kind='direct' and exactly two members; `dm_key` gives it
-- a canonical identity so "open a chat with X" is idempotent under races.
-- ============================================================================

create table public.conversations (
  id            uuid primary key default gen_random_uuid(),
  kind          public.conversation_kind not null,
  university_id uuid references public.universities (id) on delete cascade,

  -- Group-only fields
  title         text,
  avatar_url    text,
  description   text,
  created_by    uuid references public.profiles (id) on delete set null,
  member_count  integer not null default 0,
  is_public     boolean not null default false,  -- discoverable in search

  /* Canonical key for direct chats: least(a,b) || ':' || greatest(a,b).
     A unique index on it makes duplicate DM creation impossible. */
  dm_key        text,

  last_message_at   timestamptz,
  last_message_preview text,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint conversations_group_has_title check (
    kind <> 'group' or coalesce(char_length(btrim(title)), 0) between 1 and 60
  ),
  constraint conversations_direct_has_key check (
    (kind = 'direct' and dm_key is not null) or (kind = 'group' and dm_key is null)
  ),
  constraint conversations_member_count_nonneg check (member_count >= 0)
);

create unique index conversations_dm_key_idx on public.conversations (dm_key)
  where dm_key is not null;
create index conversations_recent_idx on public.conversations (last_message_at desc nulls last);
create index conversations_public_group_idx on public.conversations (university_id, member_count desc)
  where kind = 'group' and is_public;
create index conversations_title_trgm_idx on public.conversations
  using gin (title extensions.gin_trgm_ops) where kind = 'group';

create trigger conversations_touch before update on public.conversations
  for each row execute function app_private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- conversation_members
-- ---------------------------------------------------------------------------
create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  is_admin        boolean not null default false,
  /* Watermark for unread counts: the newest message this user has read. */
  last_read_at    timestamptz not null default 'epoch',
  muted_until     timestamptz,
  notifications_enabled boolean not null default true,
  joined_at       timestamptz not null default now(),
  left_at         timestamptz,

  primary key (conversation_id, user_id)
);

create index conversation_members_user_idx on public.conversation_members (user_id)
  where left_at is null;
create index conversation_members_admin_idx on public.conversation_members (conversation_id)
  where is_admin and left_at is null;

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------
create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  kind            public.message_kind not null default 'text',
  body            text,
  storage_path    text,           -- image / video / voice payload
  duration_ms     integer,        -- voice + video
  sound_id        uuid references public.sounds (id) on delete set null,
  reply_to_id     uuid references public.messages (id) on delete set null,

  /* Idempotency key supplied by the client so a retried send does not create
     a duplicate message (and does not double-count toward a streak). */
  client_nonce    uuid,

  /* Set by the streak engine when this message was the one that counted for
     the day. Purely informational for the UI. */
  counted_for_streak boolean not null default false,

  edited_at       timestamptz,
  removed_at      timestamptz,
  removed_by      uuid references public.profiles (id) on delete set null,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),

  constraint messages_body_length check (body is null or char_length(body) <= 4000),
  constraint messages_text_has_body check (
    kind <> 'text' or coalesce(char_length(btrim(body)), 0) > 0
  ),
  constraint messages_media_has_path check (
    kind not in ('image', 'video', 'voice') or storage_path is not null
  ),
  constraint messages_voice_duration check (
    kind <> 'voice' or (duration_ms is not null and duration_ms between 500 and 120000)
  )
);

-- The chat query: one conversation, newest first, paginated.
create index messages_conversation_idx on public.messages (conversation_id, created_at desc)
  where deleted_at is null;
create index messages_sender_idx on public.messages (sender_id, created_at desc);
create unique index messages_client_nonce_key on public.messages (sender_id, client_nonce)
  where client_nonce is not null;

-- ---------------------------------------------------------------------------
-- message_reactions
-- ---------------------------------------------------------------------------
create table public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  emoji      text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id),
  constraint message_reactions_allowed_emoji check (
    emoji in ('❤️', '😂', '😭', '🔥', '💀', '👀', '🫡', '🤡')
  )
);

-- ---------------------------------------------------------------------------
-- typing_indicators  (§12)
-- ---------------------------------------------------------------------------
-- Ephemeral by design: rows are upserted and swept. Kept in Postgres rather
-- than Realtime "presence" only so RLS applies uniformly.
create table public.typing_indicators (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  expires_at      timestamptz not null default now() + interval '8 seconds',
  primary key (conversation_id, user_id)
);

create index typing_indicators_expiry_idx on public.typing_indicators (expires_at);

comment on table public.messages is
  'Private message bodies. Readable only by conversation members via RLS (§12).';
