-- ============================================================================
-- Uni Streak :: 0009 counters, denormalisation, and integrity triggers
-- ============================================================================
-- Feed and profile screens must never aggregate at read time (§35), so every
-- counter is maintained incrementally here.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Role escalation guard: only a super admin may change a role, and nobody may
-- promote themselves (§32 - never trust the client for admin access).
-- ---------------------------------------------------------------------------
create or replace function app_private.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role is distinct from old.role then
    if not public.is_super_admin() or new.id = auth.uid() then
      raise exception 'role changes require a super admin' using errcode = '42501';
    end if;
  end if;

  -- Username is immutable after creation; changing it would break mentions
  -- and let a user shed their reputation. Handled by a dedicated RPC instead.
  -- The one exception is the account-deletion tombstone, which must scrub the
  -- handle (§39); that path is only reachable via public.delete_my_account.
  if new.username is distinct from old.username
     and auth.uid() is not null
     and not public.is_super_admin()
     and not (new.deleted_at is not null and old.deleted_at is null) then
    raise exception 'username cannot be changed here' using errcode = '42501';
  end if;

  -- Keep the normalised copy honest no matter who writes the row.
  new.username_normalized := app_private.normalize_handle(new.username);
  return new;
end;
$$;

create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function app_private.guard_profile_privileges();

create or replace function app_private.set_username_normalized()
returns trigger
language plpgsql
as $$
begin
  new.username_normalized := app_private.normalize_handle(new.username);
  return new;
end;
$$;

create trigger profiles_normalize_username
  before insert on public.profiles
  for each row execute function app_private.set_username_normalized();

-- ---------------------------------------------------------------------------
-- Post counters
-- ---------------------------------------------------------------------------
create or replace function app_private.sync_post_counters()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    perform set_config('unistreak.internal_write', 'on', true);
    update public.profiles set post_count = post_count + 1 where id = new.author_id;
    perform set_config('unistreak.internal_write', 'off', true);
    if new.channel_id is not null then
      perform set_config('unistreak.internal_write', 'on', true);
      update public.channels set post_count = post_count + 1 where id = new.channel_id;
      perform set_config('unistreak.internal_write', 'off', true);
    end if;
    perform app_private.mark_university_active(new.university_id, new.author_id, 'post');
  elsif tg_op = 'UPDATE' then
    -- Soft deletion or moderator removal decrements; restoration re-increments.
    if old.deleted_at is null and new.deleted_at is not null then
      perform set_config('unistreak.internal_write', 'on', true);
      update public.profiles set post_count = greatest(post_count - 1, 0) where id = new.author_id;
      perform set_config('unistreak.internal_write', 'off', true);
      if new.channel_id is not null then
        perform set_config('unistreak.internal_write', 'on', true);
        update public.channels set post_count = greatest(post_count - 1, 0) where id = new.channel_id;
        perform set_config('unistreak.internal_write', 'off', true);
      end if;
    elsif old.deleted_at is not null and new.deleted_at is null then
      perform set_config('unistreak.internal_write', 'on', true);
      update public.profiles set post_count = post_count + 1 where id = new.author_id;
      perform set_config('unistreak.internal_write', 'off', true);
      if new.channel_id is not null then
        perform set_config('unistreak.internal_write', 'on', true);
        update public.channels set post_count = post_count + 1 where id = new.channel_id;
        perform set_config('unistreak.internal_write', 'off', true);
      end if;
    end if;
  end if;
  return null;
end;
$$;

create trigger posts_sync_counters
  after insert or update on public.posts
  for each row execute function app_private.sync_post_counters();

-- ---------------------------------------------------------------------------
-- Comment counters
-- ---------------------------------------------------------------------------
create or replace function app_private.sync_comment_counters()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    perform set_config('unistreak.internal_write', 'on', true);
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
    perform set_config('unistreak.internal_write', 'off', true);
  elsif tg_op = 'UPDATE' then
    if old.deleted_at is null and new.deleted_at is not null then
      perform set_config('unistreak.internal_write', 'on', true);
      update public.posts set comment_count = greatest(comment_count - 1, 0) where id = new.post_id;
      perform set_config('unistreak.internal_write', 'off', true);
    elsif old.deleted_at is not null and new.deleted_at is null then
      perform set_config('unistreak.internal_write', 'on', true);
      update public.posts set comment_count = comment_count + 1 where id = new.post_id;
      perform set_config('unistreak.internal_write', 'off', true);
    end if;
  elsif tg_op = 'DELETE' then
    perform set_config('unistreak.internal_write', 'on', true);
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
    perform set_config('unistreak.internal_write', 'off', true);
  end if;
  return null;
end;
$$;

create trigger comments_sync_counters
  after insert or update or delete on public.comments
  for each row execute function app_private.sync_comment_counters();

-- ---------------------------------------------------------------------------
-- Reaction counters (§11 - counts update in real time)
-- ---------------------------------------------------------------------------
create or replace function app_private.sync_reaction_counters()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.post_id is not null then
      perform set_config('unistreak.internal_write', 'on', true);
      update public.posts set reaction_count = reaction_count + 1 where id = new.post_id;
      perform set_config('unistreak.internal_write', 'off', true);
    else
      perform set_config('unistreak.internal_write', 'on', true);
      update public.comments set reaction_count = reaction_count + 1 where id = new.comment_id;
      perform set_config('unistreak.internal_write', 'off', true);
    end if;
  elsif tg_op = 'DELETE' then
    if old.post_id is not null then
      perform set_config('unistreak.internal_write', 'on', true);
      update public.posts set reaction_count = greatest(reaction_count - 1, 0) where id = old.post_id;
      perform set_config('unistreak.internal_write', 'off', true);
    else
      perform set_config('unistreak.internal_write', 'on', true);
      update public.comments set reaction_count = greatest(reaction_count - 1, 0) where id = old.comment_id;
      perform set_config('unistreak.internal_write', 'off', true);
    end if;
  end if;
  -- An UPDATE only swaps the emoji, so the total is unchanged.
  return null;
end;
$$;

create trigger reactions_sync_counters
  after insert or delete on public.reactions
  for each row execute function app_private.sync_reaction_counters();

-- ---------------------------------------------------------------------------
-- Poll vote counters
-- ---------------------------------------------------------------------------
create or replace function app_private.sync_poll_counters()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    update public.poll_options set vote_count = vote_count + 1 where id = new.option_id;
  elsif tg_op = 'DELETE' then
    update public.poll_options set vote_count = greatest(vote_count - 1, 0) where id = old.option_id;
  end if;
  return null;
end;
$$;

create trigger poll_votes_sync_counters
  after insert or delete on public.poll_votes
  for each row execute function app_private.sync_poll_counters();

create or replace function app_private.sync_dq_counters()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    update public.daily_question_options set vote_count = vote_count + 1 where id = new.option_id;
    update public.daily_questions set vote_count = vote_count + 1 where id = new.question_id;
  end if;
  return null;
end;
$$;

create trigger dq_answers_sync_counters
  after insert on public.daily_question_answers
  for each row execute function app_private.sync_dq_counters();

-- ---------------------------------------------------------------------------
-- Conversation membership + last-message denormalisation
-- ---------------------------------------------------------------------------
create or replace function app_private.sync_conversation_members()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    perform set_config('unistreak.internal_write', 'on', true);
    update public.conversations set member_count = member_count + 1 where id = new.conversation_id;
    perform set_config('unistreak.internal_write', 'off', true);
  elsif tg_op = 'DELETE' then
    perform set_config('unistreak.internal_write', 'on', true);
    update public.conversations set member_count = greatest(member_count - 1, 0) where id = old.conversation_id;
    perform set_config('unistreak.internal_write', 'off', true);
  elsif tg_op = 'UPDATE' then
    if old.left_at is null and new.left_at is not null then
      perform set_config('unistreak.internal_write', 'on', true);
      update public.conversations set member_count = greatest(member_count - 1, 0) where id = new.conversation_id;
      perform set_config('unistreak.internal_write', 'off', true);
    elsif old.left_at is not null and new.left_at is null then
      perform set_config('unistreak.internal_write', 'on', true);
      update public.conversations set member_count = member_count + 1 where id = new.conversation_id;
      perform set_config('unistreak.internal_write', 'off', true);
    end if;
  end if;
  return null;
end;
$$;

create trigger conversation_members_sync
  after insert or update or delete on public.conversation_members
  for each row execute function app_private.sync_conversation_members();

-- ---------------------------------------------------------------------------
-- University daily activity rollup, feeding the university streak (§19)
-- ---------------------------------------------------------------------------
create or replace function app_private.mark_university_active(
  p_university uuid,
  p_user uuid,
  p_kind text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  tz text;
  day date;
  is_new boolean;
begin
  if p_university is null or p_user is null then return; end if;

  select timezone into tz from public.universities where id = p_university;
  if tz is null then return; end if;

  day := app_private.local_day(now(), tz);

  insert into public.university_daily_actives (university_id, local_day, user_id)
  values (p_university, day, p_user)
  on conflict do nothing;
  is_new := found;

  insert into public.university_activity (university_id, local_day, active_users,
                                          post_count, message_count, reaction_count)
  values (p_university, day, case when is_new then 1 else 0 end,
          case when p_kind = 'post' then 1 else 0 end,
          case when p_kind = 'message' then 1 else 0 end,
          case when p_kind = 'reaction' then 1 else 0 end)
  on conflict (university_id, local_day) do update set
    active_users   = public.university_activity.active_users + case when is_new then 1 else 0 end,
    post_count     = public.university_activity.post_count + case when p_kind = 'post' then 1 else 0 end,
    message_count  = public.university_activity.message_count + case when p_kind = 'message' then 1 else 0 end,
    reaction_count = public.university_activity.reaction_count + case when p_kind = 'reaction' then 1 else 0 end,
    updated_at     = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- Last-active heartbeat, used by Campus Pulse (§22)
-- ---------------------------------------------------------------------------
create or replace function app_private.touch_last_active(p_user uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  -- Only touches last_active_at, which no column guard protects, so this
  -- needs no internal-write marker.
  update public.profiles set last_active_at = now()
   where id = p_user and last_active_at < now() - interval '2 minutes';
$$;

-- ---------------------------------------------------------------------------
-- University member count
-- ---------------------------------------------------------------------------
create or replace function app_private.sync_university_members()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    perform set_config('unistreak.internal_write', 'on', true);
    update public.universities set member_count = member_count + 1 where id = new.university_id;
    perform set_config('unistreak.internal_write', 'off', true);
  elsif tg_op = 'DELETE' then
    perform set_config('unistreak.internal_write', 'on', true);
    update public.universities set member_count = greatest(member_count - 1, 0) where id = old.university_id;
    perform set_config('unistreak.internal_write', 'off', true);
  end if;
  return null;
end;
$$;

create trigger university_members_sync
  after insert or delete on public.university_members
  for each row execute function app_private.sync_university_members();
