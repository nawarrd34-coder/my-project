-- ============================================================================
-- Uni Streak :: 0010 API surface (views + RPCs)
-- ============================================================================
-- Everything the client calls that is more than a plain table read lives here.
-- Each RPC re-checks permissions itself: `security definer` bypasses RLS, so a
-- missing check is a privilege escalation, not merely a bug (§32).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Anonymity projection (§24)
-- ---------------------------------------------------------------------------
-- `security_invoker` keeps the caller's RLS in force while the view decides
-- what identity to reveal. Moderators get the real author; everyone else gets
-- a stable pseudonym derived from the profile's anon_tag.
create or replace view public.feed_posts
with (security_invoker = true) as
select
  p.id,
  p.university_id,
  p.channel_id,
  p.kind,
  p.body,
  p.sound_id,
  p.comment_count,
  p.reaction_count,
  p.hot_score,
  p.is_pinned,
  p.identity_mode,
  p.edited_at,
  p.created_at,
  p.removed_at is not null as is_removed,
  -- Author identity, withheld for anonymous posts.
  case when p.identity_mode = 'anonymous' and p.author_id <> auth.uid()
            and not public.is_moderator_of(p.university_id)
       then null else p.author_id end                       as author_id,
  case when p.identity_mode = 'anonymous' and p.author_id <> auth.uid()
            and not public.is_moderator_of(p.university_id)
       then null else pr.username end                       as author_username,
  case when p.identity_mode = 'anonymous' and p.author_id <> auth.uid()
            and not public.is_moderator_of(p.university_id)
       then null else pr.display_name end                   as author_display_name,
  case when p.identity_mode = 'anonymous' and p.author_id <> auth.uid()
            and not public.is_moderator_of(p.university_id)
       then null else pr.avatar_url end                     as author_avatar_url,
  -- Stable anonymous handle, e.g. 4821 -> "Anonymous #4821".
  case when p.identity_mode = 'anonymous' then pr.anon_tag else null end as author_anon_tag,
  u.code                                                    as university_code,
  p.author_id = auth.uid()                                  as is_mine
from public.posts p
join public.profiles pr on pr.id = p.author_id
join public.universities u on u.id = p.university_id
where p.deleted_at is null;

comment on view public.feed_posts is
  'Read model for feeds. Hides the author of anonymous posts from ordinary '
  'readers while leaving moderators able to act (§24).';

create or replace view public.thread_comments
with (security_invoker = true) as
select
  c.id,
  c.post_id,
  c.parent_id,
  c.body,
  c.reaction_count,
  c.identity_mode,
  c.edited_at,
  c.created_at,
  c.removed_at is not null as is_removed,
  case when c.identity_mode = 'anonymous' and c.author_id <> auth.uid()
       then null else c.author_id end       as author_id,
  case when c.identity_mode = 'anonymous' and c.author_id <> auth.uid()
       then null else pr.username end       as author_username,
  case when c.identity_mode = 'anonymous' and c.author_id <> auth.uid()
       then null else pr.avatar_url end     as author_avatar_url,
  case when c.identity_mode = 'anonymous' then pr.anon_tag else null end as author_anon_tag,
  c.author_id = auth.uid()                  as is_mine
from public.comments c
join public.profiles pr on pr.id = c.author_id
where c.deleted_at is null;

grant select on public.feed_posts, public.thread_comments to authenticated;

-- ---------------------------------------------------------------------------
-- Rate limiting (§29) - a fixed window per bucket, enforced server-side.
-- ---------------------------------------------------------------------------
create or replace function app_private.check_rate_limit(
  p_user uuid,
  p_bucket text,
  p_limit integer,
  p_window interval
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_window_seconds bigint := greatest(extract(epoch from p_window)::bigint, 1);
  v_window_start timestamptz := to_timestamp(
    floor(extract(epoch from now()) / v_window_seconds) * v_window_seconds
  );
  v_count integer;
begin
  insert into public.rate_limits as rl (user_id, bucket, window_start, count)
  values (p_user, p_bucket, v_window_start, 1)
  on conflict (user_id, bucket, window_start)
  do update set count = rl.count + 1
  returning rl.count into v_count;

  if v_count > p_limit then
    raise exception 'rate limit exceeded for %', p_bucket using errcode = 'P0001';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Onboarding: claim a username and create the profile (§3)
-- ---------------------------------------------------------------------------
create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_username ~ '^[A-Za-z0-9_]{3,20}$'
     and not exists (
       select 1 from public.profiles
       where username_normalized = app_private.normalize_handle(p_username)
     );
$$;

create or replace function public.complete_onboarding(
  p_username text,
  p_university_id uuid,
  p_avatar_url text default null,
  p_identity_mode public.identity_mode default 'public',
  p_timezone text default 'UTC',
  p_locale text default 'en',
  p_display_name text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  result public.profiles;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if not public.username_available(p_username) then
    raise exception 'username unavailable' using errcode = '23505';
  end if;

  if not exists (select 1 from public.universities where id = p_university_id and is_active) then
    raise exception 'unknown university' using errcode = '23503';
  end if;

  -- Validate the timezone rather than trusting the client string, or every
  -- later streak calculation would fail on a bad value.
  begin
    perform now() at time zone p_timezone;
  exception when others then
    p_timezone := 'UTC';
  end;

  insert into public.profiles (
    id, university_id, username, username_normalized, display_name, avatar_url,
    anon_tag, timezone, locale, default_identity
  ) values (
    uid, p_university_id, p_username, app_private.normalize_handle(p_username),
    p_display_name, p_avatar_url,
    -- Random but stable per profile; not derived from the user id, so it
    -- cannot be reversed into an identity.
    1000 + floor(random() * 9000)::int,
    p_timezone, p_locale, p_identity_mode
  )
  on conflict (id) do update set
    university_id    = excluded.university_id,
    avatar_url       = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    timezone         = excluded.timezone,
    locale           = excluded.locale,
    default_identity = excluded.default_identity
  returning * into result;

  insert into public.university_members (university_id, user_id, is_primary)
  values (p_university_id, uid, true)
  on conflict do nothing;

  insert into public.notification_settings (user_id) values (uid)
  on conflict do nothing;

  -- "First week" badge is granted on join and is what makes an empty profile
  -- feel like a start rather than a void.
  insert into public.user_badges (user_id, badge_id)
  select uid, id from public.badges where id = 'first_week'
  on conflict do nothing;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Direct conversations (§12)
-- ---------------------------------------------------------------------------
/* Idempotently open the DM between the caller and another user. */
create or replace function public.open_direct_conversation(p_other uuid)
returns public.conversations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  key text;
  convo public.conversations;
  other_profile public.profiles;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if uid = p_other then raise exception 'cannot message yourself' using errcode = '22023'; end if;
  if public.is_banned() then raise exception 'account restricted' using errcode = '42501'; end if;

  select * into other_profile from public.profiles where id = p_other and deleted_at is null;
  if not found then raise exception 'user not found' using errcode = 'P0002'; end if;

  if public.has_block_between(p_other) then
    raise exception 'cannot message this user' using errcode = '42501';
  end if;

  if not other_profile.allow_direct_messages then
    raise exception 'this user does not accept direct messages' using errcode = '42501';
  end if;

  key := public.dm_key_for(uid, p_other);

  insert into public.conversations (kind, dm_key, university_id, created_by)
  values ('direct', key, other_profile.university_id, uid)
  on conflict (dm_key) where dm_key is not null
  do update set updated_at = now()
  returning * into convo;

  insert into public.conversation_members (conversation_id, user_id)
  values (convo.id, uid), (convo.id, p_other)
  on conflict (conversation_id, user_id) do update set left_at = null;

  return convo;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sending a message: the one write that also drives the streak engine (§15)
-- ---------------------------------------------------------------------------
create or replace function public.send_message(
  p_conversation uuid,
  p_body text default null,
  p_kind public.message_kind default 'text',
  p_storage_path text default null,
  p_duration_ms integer default null,
  p_reply_to uuid default null,
  p_sound_id uuid default null,
  p_client_nonce uuid default null
)
returns public.messages
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  convo public.conversations;
  msg public.messages;
  other_member uuid;
  streak public.streaks;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if public.is_banned() then raise exception 'account restricted' using errcode = '42501'; end if;

  if not public.is_conversation_member(p_conversation) then
    raise exception 'not a member of this conversation' using errcode = '42501';
  end if;

  select * into convo from public.conversations where id = p_conversation;

  -- 60 messages/minute is far above human cadence but blunts scripted floods.
  perform app_private.check_rate_limit(uid, 'message', 60, interval '1 minute');

  -- Idempotent retry: return the message the client already sent.
  if p_client_nonce is not null then
    select * into msg from public.messages
     where sender_id = uid and client_nonce = p_client_nonce;
    if found then return msg; end if;
  end if;

  insert into public.messages (
    conversation_id, sender_id, kind, body, storage_path,
    duration_ms, reply_to_id, sound_id, client_nonce
  ) values (
    p_conversation, uid, p_kind, p_body, p_storage_path,
    p_duration_ms, p_reply_to, p_sound_id, p_client_nonce
  )
  returning * into msg;

  update public.conversations
     set last_message_at = msg.created_at,
         last_message_preview = left(coalesce(p_body, p_kind::text), 120)
   where id = p_conversation;

  update public.profiles set message_count = message_count + 1 where id = uid;
  perform app_private.touch_last_active(uid);
  perform app_private.mark_university_active(convo.university_id, uid, 'message');

  -- Direct messages feed the streak engine. Group messages deliberately do
  -- not (§15: "meaningful interaction", not any chatter in a big room).
  if convo.kind = 'direct' then
    select user_id into other_member from public.conversation_members
     where conversation_id = p_conversation and user_id <> uid and left_at is null
     limit 1;

    if other_member is not null and not public.has_block_between(other_member) then
      streak := app_private.ensure_direct_streak(uid, other_member, p_conversation);
      streak := app_private.record_streak_activity(streak.id, uid, 'direct_message', msg.id);
    end if;
  end if;

  return msg;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reactions (§11) - toggle semantics in one round trip
-- ---------------------------------------------------------------------------
create or replace function public.toggle_post_reaction(p_post uuid, p_emoji text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  existing text;
  post_row public.posts;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if public.is_banned() then raise exception 'account restricted' using errcode = '42501'; end if;

  select * into post_row from public.posts where id = p_post and deleted_at is null;
  if not found then raise exception 'post not found' using errcode = 'P0002'; end if;

  if not public.can_see_university(post_row.university_id) then
    raise exception 'not your university' using errcode = '42501';
  end if;

  perform app_private.check_rate_limit(uid, 'reaction', 120, interval '1 minute');

  select emoji into existing from public.reactions
   where post_id = p_post and user_id = uid;

  if existing is null then
    insert into public.reactions (post_id, user_id, emoji) values (p_post, uid, p_emoji);
    perform app_private.mark_university_active(post_row.university_id, uid, 'reaction');
    return p_emoji;
  elsif existing = p_emoji then
    delete from public.reactions where post_id = p_post and user_id = uid;
    return null;
  else
    update public.reactions set emoji = p_emoji where post_id = p_post and user_id = uid;
    return p_emoji;
  end if;
end;
$$;

create or replace function public.toggle_comment_reaction(p_comment uuid, p_emoji text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare uid uuid := auth.uid(); existing text;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if public.is_banned() then raise exception 'account restricted' using errcode = '42501'; end if;

  select emoji into existing from public.reactions where comment_id = p_comment and user_id = uid;

  if existing is null then
    insert into public.reactions (comment_id, user_id, emoji) values (p_comment, uid, p_emoji);
    return p_emoji;
  elsif existing = p_emoji then
    delete from public.reactions where comment_id = p_comment and user_id = uid;
    return null;
  else
    update public.reactions set emoji = p_emoji where comment_id = p_comment and user_id = uid;
    return p_emoji;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Posting (§10) with rate limiting and poll options in one transaction
-- ---------------------------------------------------------------------------
create or replace function public.create_post(
  p_body text,
  p_kind public.post_kind default 'text',
  p_channel_id uuid default null,
  p_identity_mode public.identity_mode default null,
  p_media jsonb default '[]'::jsonb,
  p_poll_options text[] default null,
  p_sound_id uuid default null
)
returns public.posts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  me public.profiles;
  post public.posts;
  item jsonb;
  idx integer := 0;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if public.is_banned() then raise exception 'account restricted' using errcode = '42501'; end if;

  select * into me from public.profiles where id = uid and deleted_at is null;
  if not found then raise exception 'no profile' using errcode = 'P0002'; end if;

  perform app_private.check_rate_limit(uid, 'post', 10, interval '5 minutes');

  if p_kind = 'poll' and (p_poll_options is null or array_length(p_poll_options, 1) < 2) then
    raise exception 'a poll needs at least two options' using errcode = '22023';
  end if;

  insert into public.posts (
    university_id, channel_id, author_id, identity_mode, kind, body, sound_id
  ) values (
    me.university_id, p_channel_id, uid,
    coalesce(p_identity_mode, me.default_identity), p_kind, p_body, p_sound_id
  )
  returning * into post;

  for item in select * from jsonb_array_elements(coalesce(p_media, '[]'::jsonb)) loop
    insert into public.post_media (post_id, kind, storage_path, width, height, duration_ms, blurhash, position)
    values (
      post.id,
      (item->>'kind')::public.media_kind,
      item->>'storage_path',
      (item->>'width')::integer,
      (item->>'height')::integer,
      (item->>'duration_ms')::integer,
      item->>'blurhash',
      idx
    );
    idx := idx + 1;
  end loop;

  if p_kind = 'poll' then
    for idx in 1 .. array_length(p_poll_options, 1) loop
      insert into public.poll_options (post_id, label, position)
      values (post.id, p_poll_options[idx], idx - 1);
    end loop;
  end if;

  if p_sound_id is not null then
    update public.sounds set use_count = use_count + 1 where id = p_sound_id;
  end if;

  perform app_private.touch_last_active(uid);
  return post;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: expose exactly the RPCs the client needs, to authenticated only.
-- ---------------------------------------------------------------------------
revoke all on function
  public.username_available(text),
  public.complete_onboarding(text, uuid, text, public.identity_mode, text, text, text),
  public.open_direct_conversation(uuid),
  public.send_message(uuid, text, public.message_kind, text, integer, uuid, uuid, uuid),
  public.toggle_post_reaction(uuid, text),
  public.toggle_comment_reaction(uuid, text),
  public.create_post(text, public.post_kind, uuid, public.identity_mode, jsonb, text[], uuid)
from public, anon;

grant execute on function
  public.complete_onboarding(text, uuid, text, public.identity_mode, text, text, text),
  public.open_direct_conversation(uuid),
  public.send_message(uuid, text, public.message_kind, text, integer, uuid, uuid, uuid),
  public.toggle_post_reaction(uuid, text),
  public.toggle_comment_reaction(uuid, text),
  public.create_post(text, public.post_kind, uuid, public.identity_mode, jsonb, text[], uuid)
to authenticated;

-- Username availability is needed during signup, before a session exists.
grant execute on function public.username_available(text) to anon, authenticated;
