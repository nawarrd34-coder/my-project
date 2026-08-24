-- ============================================================================
-- Uni Streak :: 0016 server-owned columns
-- ============================================================================
-- RLS decides *which rows* a user may write. It says nothing about *which
-- columns*, so a client talking to PostgREST directly could set fields the
-- app never exposes:
--
--   posts.is_pinned / hot_score / comment_count / reaction_count
--       -> self-pin to the top of the feed and fake a trending post
--   profiles.longest_streak / post_count / message_count
--       -> a fabricated leaderboard position and streak record
--   sounds.is_approved      -> bypass sound moderation
--   conversations.member_count, channels.post_count, universities.member_count
--       -> fake activity numbers
--
-- Every one of these is derived: some trigger or engine function already owns
-- it. These guards pin each column to its existing (or default) value whenever
-- an end user is the writer, so the only way to move them stays the code that
-- legitimately maintains them.
--
-- `auth.uid() is null` means the writer is the service role or a
-- security-definer function, which is exactly who is allowed to set them.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- posts
-- ---------------------------------------------------------------------------
create or replace function app_private.guard_post_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  is_mod boolean;
begin
  if auth.uid() is null or app_private.is_internal_write() then
    return new;
  end if;

  is_mod := public.is_moderator_of(new.university_id);

  if tg_op = 'INSERT' then
    -- A brand new post starts with no engagement, whatever the client claims.
    new.comment_count  := 0;
    new.reaction_count := 0;
    new.hot_score      := 0;
    new.removed_at     := null;
    new.removed_by     := null;
    -- Only a moderator may pin.
    if not is_mod then new.is_pinned := false; end if;
    return new;
  end if;

  -- On update, carry the server's values forward.
  new.comment_count  := old.comment_count;
  new.reaction_count := old.reaction_count;
  new.hot_score      := old.hot_score;

  if not is_mod then
    new.is_pinned  := old.is_pinned;
    new.removed_at := old.removed_at;
    new.removed_by := old.removed_by;
    -- The author may not reassign their post to someone else.
    new.author_id     := old.author_id;
    new.university_id := old.university_id;
  end if;

  return new;
end;
$$;

create trigger posts_guard_columns
  before insert or update on public.posts
  for each row execute function app_private.guard_post_columns();

-- ---------------------------------------------------------------------------
-- comments
-- ---------------------------------------------------------------------------
create or replace function app_private.guard_comment_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or app_private.is_internal_write() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.reaction_count := 0;
    new.removed_at := null;
    new.removed_by := null;
    return new;
  end if;

  new.reaction_count := old.reaction_count;
  new.author_id := old.author_id;
  new.post_id := old.post_id;

  -- Only a moderator may set or clear the removal stamp.
  if not exists (
    select 1 from public.posts p
    where p.id = new.post_id and public.is_moderator_of(p.university_id)
  ) then
    new.removed_at := old.removed_at;
    new.removed_by := old.removed_by;
  end if;

  return new;
end;
$$;

create trigger comments_guard_columns
  before insert or update on public.comments
  for each row execute function app_private.guard_comment_columns();

-- ---------------------------------------------------------------------------
-- profiles: aggregate counters are maintained by triggers and the engine.
-- ---------------------------------------------------------------------------
create or replace function app_private.guard_profile_counters()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or app_private.is_internal_write() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.post_count     := 0;
    new.message_count  := 0;
    new.longest_streak := 0;
    return new;
  end if;

  new.post_count     := old.post_count;
  new.message_count  := old.message_count;
  new.longest_streak := old.longest_streak;
  -- A user cannot move themselves between universities by editing the row;
  -- that is a membership change, not a profile edit.
  if not public.is_super_admin() then
    new.university_id := old.university_id;
    new.anon_tag      := old.anon_tag;
  end if;

  return new;
end;
$$;

create trigger profiles_guard_counters
  before insert or update on public.profiles
  for each row execute function app_private.guard_profile_counters();

-- ---------------------------------------------------------------------------
-- sounds: approval is a moderation decision, use_count is derived.
-- ---------------------------------------------------------------------------
create or replace function app_private.guard_sound_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or app_private.is_internal_write() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.use_count   := 0;
    new.is_approved := false;
    new.is_removed  := false;
    return new;
  end if;

  new.use_count := old.use_count;
  if not public.is_moderator_of(new.university_id) then
    new.is_approved := old.is_approved;
    new.is_removed  := old.is_removed;
  end if;

  return new;
end;
$$;

create trigger sounds_guard_columns
  before insert or update on public.sounds
  for each row execute function app_private.guard_sound_columns();

-- ---------------------------------------------------------------------------
-- conversations / channels / universities: derived counters.
-- ---------------------------------------------------------------------------
create or replace function app_private.guard_conversation_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or app_private.is_internal_write() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.member_count := 0;
    new.last_message_at := null;
    new.last_message_preview := null;
    return new;
  end if;

  new.member_count := old.member_count;
  new.kind := old.kind;
  new.dm_key := old.dm_key;
  new.created_by := old.created_by;
  return new;
end;
$$;

create trigger conversations_guard_columns
  before insert or update on public.conversations
  for each row execute function app_private.guard_conversation_columns();

create or replace function app_private.guard_channel_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or app_private.is_internal_write() then return new; end if;
  if tg_op = 'INSERT' then
    new.post_count := 0;
  else
    new.post_count := old.post_count;
  end if;
  return new;
end;
$$;

create trigger channels_guard_columns
  before insert or update on public.channels
  for each row execute function app_private.guard_channel_columns();

create or replace function app_private.guard_university_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or app_private.is_internal_write() then return new; end if;
  if tg_op = 'INSERT' then
    new.member_count := 0;
  else
    new.member_count := old.member_count;
    -- The code is the university's stable identity; renaming is fine,
    -- re-keying is not.
    new.code := old.code;
  end if;
  return new;
end;
$$;

create trigger universities_guard_columns
  before insert or update on public.universities
  for each row execute function app_private.guard_university_columns();
