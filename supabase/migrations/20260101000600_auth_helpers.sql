-- ============================================================================
-- Uni Streak :: 0006 authorization helpers
-- ============================================================================
-- These functions are the vocabulary every RLS policy is written in. They are
-- `security definer` so they can read tables the calling user cannot, and they
-- pin `search_path` so a caller cannot shadow a table name and hijack them.
--
-- Every one is STABLE, so Postgres evaluates them once per statement rather
-- than once per row.
-- ============================================================================

-- Current user's profile row, or null when unauthenticated / deleted.
create or replace function public.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.* from public.profiles p
  where p.id = auth.uid() and p.deleted_at is null;
$$;

create or replace function public.current_university_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select university_id from public.profiles
  where id = auth.uid() and deleted_at is null;
$$;

create or replace function public.current_role_level()
returns public.app_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid() and deleted_at is null),
    'student'::public.app_role
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_role_level() = 'super_admin';
$$;

/* Moderator-or-above for a given university. super_admin passes for all. */
create or replace function public.is_moderator_of(target_university uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.deleted_at is null
      and (
        p.role = 'super_admin'
        or (p.role in ('moderator', 'university_admin') and p.university_id = target_university)
      )
  );
$$;

/* University-admin-or-above for a given university. */
create or replace function public.is_university_admin_of(target_university uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.deleted_at is null
      and (
        p.role = 'super_admin'
        or (p.role = 'university_admin' and p.university_id = target_university)
      )
  );
$$;

/* True when the current user is under an active ban. Checked on every write
   path so a banned user cannot post, message, or react (§29). */
create or replace function public.is_banned()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.bans b
    where b.user_id = auth.uid()
      and b.lifted_at is null
      and (b.expires_at is null or b.expires_at > now())
  );
$$;

/* Blocking is symmetric for visibility: if either side blocked the other,
   neither sees the other's content or can message them (§29). */
create or replace function public.has_block_between(other_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = other_user)
       or (b.blocker_id = other_user and b.blocked_id = auth.uid())
  );
$$;

/* Membership test used by every messaging policy. Security definer because
   the member row itself is protected by RLS - a plain subquery inside a
   policy on `messages` would recurse into the policy on
   `conversation_members`. */
create or replace function public.is_conversation_member(target_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.conversation_members m
    where m.conversation_id = target_conversation
      and m.user_id = auth.uid()
      and m.left_at is null
  );
$$;

create or replace function public.is_conversation_admin(target_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.conversation_members m
    where m.conversation_id = target_conversation
      and m.user_id = auth.uid()
      and m.left_at is null
      and m.is_admin
  );
$$;

/* Canonical direct-conversation key, so "chat with X" resolves to one row. */
create or replace function public.dm_key_for(a uuid, b uuid)
returns text
language sql
immutable
strict
as $$
  select least(a::text, b::text) || ':' || greatest(a::text, b::text);
$$;

/* Content visibility: a post is visible if it is in the reader's university,
   not deleted or moderator-removed, and not authored by someone in a block
   relationship with the reader. */
create or replace function public.can_see_university(target_university uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.university_members m
    where m.user_id = auth.uid() and m.university_id = target_university
  ) or public.is_super_admin();
$$;

/* Users the current user has blocked, or who blocked them. Used to filter
   feeds in one indexed anti-join rather than per-row function calls. */
create or replace function public.blocked_user_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select blocked_id from public.blocks where blocker_id = auth.uid()
  union
  select blocker_id from public.blocks where blocked_id = auth.uid();
$$;

revoke all on function
  public.current_profile(),
  public.current_university_id(),
  public.current_role_level(),
  public.is_super_admin(),
  public.is_moderator_of(uuid),
  public.is_university_admin_of(uuid),
  public.is_banned(),
  public.has_block_between(uuid),
  public.is_conversation_member(uuid),
  public.is_conversation_admin(uuid),
  public.can_see_university(uuid),
  public.blocked_user_ids()
from public, anon;

grant execute on function
  public.current_profile(),
  public.current_university_id(),
  public.current_role_level(),
  public.is_super_admin(),
  public.is_moderator_of(uuid),
  public.is_university_admin_of(uuid),
  public.is_banned(),
  public.has_block_between(uuid),
  public.is_conversation_member(uuid),
  public.is_conversation_admin(uuid),
  public.can_see_university(uuid),
  public.blocked_user_ids()
to authenticated;

grant execute on function public.dm_key_for(uuid, uuid) to authenticated;
