-- ============================================================================
-- Uni Streak :: 0000 extensions, enums, and shared helpers
-- ============================================================================
-- Everything below runs inside the Supabase-managed `public` schema unless a
-- schema is named explicitly. Privileged logic lives in `app_private`, which
-- is never exposed through PostgREST.
-- ============================================================================

create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "pg_trgm" with schema extensions;
create extension if not exists "btree_gist" with schema extensions;

-- Private schema: helper functions and internals the API must never expose.
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Enumerated types
-- ---------------------------------------------------------------------------

create type public.identity_mode as enum ('public', 'anonymous');

create type public.app_role as enum (
  'student',        -- ordinary user
  'moderator',      -- can act on reports within their university
  'university_admin', -- can manage channels/questions for their university
  'super_admin'     -- platform wide
);

create type public.post_kind as enum ('text', 'image', 'video', 'poll', 'sound', 'streak');

create type public.media_kind as enum ('image', 'video', 'audio');

create type public.conversation_kind as enum ('direct', 'group');

create type public.message_kind as enum ('text', 'image', 'video', 'voice', 'sound', 'streak', 'system');

create type public.streak_status as enum (
  'pending',  -- day 1 recorded, not yet a counted streak
  'active',   -- counted streak of >= 2 days
  'expired',  -- missed the deadline
  'restored'  -- explicitly recovered by the user
);

create type public.streak_scope as enum ('direct', 'university');

create type public.report_status as enum ('open', 'reviewing', 'actioned', 'dismissed');

create type public.report_reason as enum (
  'spam', 'harassment', 'hate', 'sexual', 'violence',
  'self_harm', 'impersonation', 'misinformation', 'other'
);

create type public.report_target as enum ('post', 'comment', 'message', 'user', 'group');

create type public.ban_scope as enum ('university', 'platform');

create type public.notification_kind as enum (
  'streak_waiting', 'streak_expiring', 'streak_milestone',
  'post_reply', 'post_reaction', 'new_message',
  'daily_question', 'university_trending', 'badge_earned', 'moderation'
);

create type public.moderation_action as enum (
  'remove_content', 'restore_content', 'ban_user', 'unban_user',
  'dismiss_report', 'resolve_report', 'edit_university', 'create_channel',
  'remove_channel', 'create_daily_question', 'set_streak_threshold'
);

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

-- `updated_at` maintenance, attached by trigger to every mutable table.
create or replace function app_private.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Case/diacritic-insensitive slug for search and uniqueness checks.
create or replace function app_private.normalize_handle(value text)
returns text
language sql
immutable
strict
as $$
  select lower(regexp_replace(value, '\s+', '', 'g'));
$$;


-- ---------------------------------------------------------------------------
-- Internal-write marker
-- ---------------------------------------------------------------------------
-- Counter maintenance runs inside triggers and security-definer functions,
-- which still see the end user's `auth.uid()` - security definer changes the
-- role, not the JWT claims. The column guards therefore cannot tell "the
-- engine is incrementing a counter" from "a client is forging one".
--
-- This transaction-local marker is that signal. It is set for the duration of
-- a single UPDATE and cleared immediately, so it can never be left on for a
-- client statement. `set_config` lives in pg_catalog and is not exposed
-- through PostgREST, so a client cannot raise the flag itself.
create or replace function app_private.is_internal_write()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('unistreak.internal_write', true), '') = 'on';
$$;

comment on schema app_private is
  'Internal helpers and privileged logic. Not exposed via PostgREST.';
