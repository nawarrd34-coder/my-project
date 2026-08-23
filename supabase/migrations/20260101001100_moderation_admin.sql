-- ============================================================================
-- Uni Streak :: 0011 moderation, admin, university streak, pulse, deletion
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Reporting (§29)
-- ---------------------------------------------------------------------------
create or replace function public.submit_report(
  p_target public.report_target,
  p_reason public.report_reason,
  p_post uuid default null,
  p_comment uuid default null,
  p_message uuid default null,
  p_user uuid default null,
  p_conversation uuid default null,
  p_details text default null
)
returns public.reports
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  target_university uuid;
  result public.reports;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;

  perform app_private.check_rate_limit(uid, 'report', 20, interval '1 hour');

  -- Resolve the university so the right moderators see it.
  target_university := coalesce(
    (select university_id from public.posts where id = p_post),
    (select p.university_id from public.comments c join public.posts p on p.id = c.post_id where c.id = p_comment),
    (select c.university_id from public.messages m join public.conversations c on c.id = m.conversation_id where m.id = p_message),
    (select university_id from public.profiles where id = p_user),
    (select university_id from public.conversations where id = p_conversation),
    public.current_university_id()
  );

  insert into public.reports (
    reporter_id, target, post_id, comment_id, message_id,
    reported_user_id, conversation_id, university_id, reason, details
  ) values (
    uid, p_target, p_post, p_comment, p_message,
    p_user, p_conversation, target_university, p_reason, p_details
  )
  returning * into result;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Blocking (§29) - also ends any streak with that person, honestly recorded.
-- ---------------------------------------------------------------------------
create or replace function public.block_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  s public.streaks;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if uid = p_user then raise exception 'cannot block yourself' using errcode = '22023'; end if;

  insert into public.blocks (blocker_id, blocked_id) values (uid, p_user)
  on conflict do nothing;

  select * into s from public.streaks
   where scope = 'direct'
     and user_low = least(uid, p_user) and user_high = greatest(uid, p_user);

  if found and s.status in ('pending', 'active', 'restored') then
    if s.current_length >= 2 then
      insert into public.streak_history (streak_id, length, started_on, ended_on, ended_reason)
      values (s.id, s.current_length, s.started_on, s.last_qualified_on, 'blocked');
    end if;
    update public.streaks
       set status = 'expired', current_length = 0, expired_at = now()
     where id = s.id;
  end if;
end;
$$;

create or replace function public.unblock_user(p_user uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.blocks where blocker_id = auth.uid() and blocked_id = p_user;
$$;

-- ---------------------------------------------------------------------------
-- Moderator actions (§30) - every one writes an audit row.
-- ---------------------------------------------------------------------------
create or replace function public.moderate_remove_post(p_post uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare target public.posts;
begin
  select * into target from public.posts where id = p_post;
  if not found then raise exception 'post not found' using errcode = 'P0002'; end if;

  if not public.is_moderator_of(target.university_id) then
    raise exception 'not a moderator' using errcode = '42501';
  end if;

  update public.posts set removed_at = now(), removed_by = auth.uid() where id = p_post;

  insert into public.admin_actions (admin_id, action, target_type, target_id, university_id, note)
  values (auth.uid(), 'remove_content', 'post', p_post, target.university_id, p_note);
end;
$$;

create or replace function public.moderate_ban_user(
  p_user uuid,
  p_reason text,
  p_duration interval default null,
  p_scope public.ban_scope default 'platform'
)
returns public.bans
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target public.profiles;
  result public.bans;
begin
  select * into target from public.profiles where id = p_user;
  if not found then raise exception 'user not found' using errcode = 'P0002'; end if;

  if not public.is_moderator_of(target.university_id) then
    raise exception 'not a moderator' using errcode = '42501';
  end if;

  -- Moderators cannot ban their peers or superiors.
  if target.role <> 'student' and not public.is_super_admin() then
    raise exception 'insufficient privileges' using errcode = '42501';
  end if;

  insert into public.bans (user_id, scope, university_id, reason, issued_by, expires_at)
  values (
    p_user, p_scope,
    case when p_scope = 'university' then target.university_id else null end,
    p_reason, auth.uid(),
    case when p_duration is null then null else now() + p_duration end
  )
  returning * into result;

  insert into public.admin_actions (admin_id, action, target_type, target_id, university_id, note, metadata)
  values (auth.uid(), 'ban_user', 'user', p_user, target.university_id, p_reason,
          jsonb_build_object('permanent', p_duration is null));

  return result;
end;
$$;

create or replace function public.moderate_unban_user(p_user uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare target public.profiles;
begin
  select * into target from public.profiles where id = p_user;
  if not found then raise exception 'user not found' using errcode = 'P0002'; end if;
  if not public.is_moderator_of(target.university_id) then
    raise exception 'not a moderator' using errcode = '42501';
  end if;

  update public.bans set lifted_at = now()
   where user_id = p_user and lifted_at is null;

  insert into public.admin_actions (admin_id, action, target_type, target_id, university_id, note)
  values (auth.uid(), 'unban_user', 'user', p_user, target.university_id, p_note);
end;
$$;

create or replace function public.moderate_resolve_report(
  p_report uuid,
  p_status public.report_status,
  p_note text default null
)
returns public.reports
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare result public.reports;
begin
  select * into result from public.reports where id = p_report;
  if not found then raise exception 'report not found' using errcode = 'P0002'; end if;
  if not public.is_moderator_of(coalesce(result.university_id, public.current_university_id())) then
    raise exception 'not a moderator' using errcode = '42501';
  end if;

  update public.reports
     set status = p_status, resolved_by = auth.uid(),
         resolution_note = p_note, resolved_at = now()
   where id = p_report
  returning * into result;

  insert into public.admin_actions (admin_id, action, target_type, target_id, university_id, note)
  values (auth.uid(),
          case when p_status = 'dismissed' then 'dismiss_report' else 'resolve_report' end,
          'report', p_report, result.university_id, p_note);

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- University streak roll-forward (§19)
-- ---------------------------------------------------------------------------
/*
  Close out `p_day` for one university: stamp the threshold that applied, and
  extend or break the university streak accordingly. Idempotent, so the daily
  job can safely re-run.
*/
create or replace function app_private.roll_university_streak(
  p_university uuid,
  p_day date
)
returns public.streaks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uni public.universities;
  activity public.university_activity;
  s public.streaks;
  met boolean;
  gap integer;
begin
  select * into uni from public.universities where id = p_university;
  if not found then return null; end if;

  select * into activity from public.university_activity
   where university_id = p_university and local_day = p_day;

  met := coalesce(activity.active_users, 0) >= uni.streak_threshold;

  insert into public.university_activity (university_id, local_day, active_users,
                                          threshold_applied, met_threshold)
  values (p_university, p_day, coalesce(activity.active_users, 0), uni.streak_threshold, met)
  on conflict (university_id, local_day) do update set
    threshold_applied = uni.streak_threshold,
    met_threshold = met,
    updated_at = now();

  insert into public.streaks (scope, university_id, timezone, status)
  values ('university', p_university, uni.timezone, 'pending')
  on conflict (university_id) where scope = 'university' do nothing;

  select * into s from public.streaks
   where scope = 'university' and university_id = p_university for update;

  -- Already counted this day: nothing to do.
  if s.last_qualified_on is not null and s.last_qualified_on >= p_day then
    return s;
  end if;

  if met then
    if s.last_qualified_on is null then
      s.current_length := 0;
      s.status := 'pending';
      s.started_on := p_day;
    else
      gap := p_day - s.last_qualified_on;
      if gap = 1 then
        s.current_length := case when s.current_length = 0 then 2 else s.current_length + 1 end;
        s.status := 'active';
      else
        if s.current_length >= 2 then
          insert into public.streak_history (streak_id, length, started_on, ended_on, ended_reason)
          values (s.id, s.current_length, s.started_on, s.last_qualified_on, 'expired');
        end if;
        s.current_length := 0;
        s.status := 'pending';
        s.started_on := p_day;
      end if;
    end if;
    s.last_qualified_on := p_day;
    s.longest_length := greatest(s.longest_length, s.current_length);
  else
    -- Threshold missed: the run ends.
    if s.current_length >= 2 then
      insert into public.streak_history (streak_id, length, started_on, ended_on, ended_reason)
      values (s.id, s.current_length, s.started_on, s.last_qualified_on, 'expired');
    end if;
    s.current_length := 0;
    s.status := 'expired';
  end if;

  update public.streaks set
    status = s.status,
    current_length = s.current_length,
    longest_length = s.longest_length,
    last_qualified_on = s.last_qualified_on,
    started_on = s.started_on,
    expires_at = app_private.end_of_local_day(p_day + 1, s.timezone)
  where id = s.id
  returning * into s;

  return s;
end;
$$;

-- ---------------------------------------------------------------------------
-- Campus Pulse (§22) - one round trip for the whole header.
-- ---------------------------------------------------------------------------
create or replace function public.campus_pulse(p_university uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  uni_id uuid := coalesce(p_university, public.current_university_id());
  uni public.universities;
  today date;
begin
  if uni_id is null then raise exception 'no university' using errcode = '22023'; end if;
  if not public.can_see_university(uni_id) then
    raise exception 'not your university' using errcode = '42501';
  end if;

  select * into uni from public.universities where id = uni_id;
  today := app_private.local_day(now(), uni.timezone);

  return jsonb_build_object(
    'university_id', uni.id,
    'university_code', uni.code,
    'active_today', coalesce(
      (select active_users from public.university_activity
        where university_id = uni_id and local_day = today), 0),
    'posts_today', coalesce(
      (select post_count from public.university_activity
        where university_id = uni_id and local_day = today), 0),
    'messages_today', coalesce(
      (select message_count from public.university_activity
        where university_id = uni_id and local_day = today), 0),
    'university_streak', coalesce(
      (select current_length from public.streaks
        where scope = 'university' and university_id = uni_id), 0),
    'streak_threshold', uni.streak_threshold,
    'online_now', (
      select count(*) from public.profiles
       where university_id = uni_id and deleted_at is null
         and show_online_status and last_active_at > now() - interval '5 minutes'),
    'trending_posts', coalesce((
      select jsonb_agg(t) from (
        select p.id, p.body, p.reaction_count, p.comment_count, p.kind
          from public.posts p
         where p.university_id = uni_id and p.deleted_at is null and p.removed_at is null
           and p.created_at > now() - interval '48 hours'
         order by (p.reaction_count * 2 + p.comment_count * 3) desc, p.created_at desc
         limit 5
      ) t), '[]'::jsonb),
    'active_groups', coalesce((
      select jsonb_agg(g) from (
        select c.id, c.title, c.member_count, c.last_message_at
          from public.conversations c
         where c.university_id = uni_id and c.kind = 'group' and c.is_public
         order by c.last_message_at desc nulls last
         limit 5
      ) g), '[]'::jsonb),
    'trending_sounds', coalesce((
      select jsonb_agg(s) from (
        select s.id, s.title, s.use_count, s.duration_ms
          from public.sounds s
         where (s.university_id = uni_id or s.university_id is null)
           and s.is_approved and not s.is_removed
         order by s.use_count desc
         limit 5
      ) s), '[]'::jsonb),
    'daily_question', (
      select jsonb_build_object(
               'id', q.id, 'question_en', q.question_en, 'question_ar', q.question_ar,
               'closes_at', q.closes_at, 'vote_count', q.vote_count,
               'answered', exists (
                 select 1 from public.daily_question_answers a
                  where a.question_id = q.id and a.user_id = auth.uid()),
               'options', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'id', o.id, 'label_en', o.label_en, 'label_ar', o.label_ar,
                          'vote_count', o.vote_count) order by o.position)
                   from public.daily_question_options o where o.question_id = q.id), '[]'::jsonb))
        from public.daily_questions q
       where q.university_id = uni_id and q.local_day = today
       limit 1)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- University battles (§20) - playful, based on today's activity share.
-- ---------------------------------------------------------------------------
create or replace function public.university_battle(p_a uuid, p_b uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  a_score numeric;
  b_score numeric;
  total numeric;
begin
  select coalesce(
    (select ua.active_users::numeric / greatest(u.member_count, 1)
       from public.university_activity ua join public.universities u on u.id = ua.university_id
      where ua.university_id = p_a and ua.local_day = app_private.local_day(now(), u.timezone)), 0)
  into a_score;

  select coalesce(
    (select ua.active_users::numeric / greatest(u.member_count, 1)
       from public.university_activity ua join public.universities u on u.id = ua.university_id
      where ua.university_id = p_b and ua.local_day = app_private.local_day(now(), u.timezone)), 0)
  into b_score;

  -- Participation rate, not raw volume, so a small campus can still win.
  total := greatest(a_score + b_score, 0.0001);

  return jsonb_build_object(
    'a', jsonb_build_object('university_id', p_a, 'share', round(100 * a_score / total)),
    'b', jsonb_build_object('university_id', p_b, 'share', round(100 * b_score / total))
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Leaderboards (§27) - respect the hide-me switch.
-- ---------------------------------------------------------------------------
create or replace function public.university_leaderboard(p_limit integer default 20)
returns table (
  university_id uuid, code text, name_en text, name_ar text,
  streak_length integer, active_today integer, member_count integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id, u.code, u.name_en, u.name_ar,
         coalesce(s.current_length, 0),
         coalesce(ua.active_users, 0),
         u.member_count
    from public.universities u
    left join public.streaks s
      on s.scope = 'university' and s.university_id = u.id
    left join public.university_activity ua
      on ua.university_id = u.id
     and ua.local_day = app_private.local_day(now(), u.timezone)
   where u.is_active
   order by coalesce(s.current_length, 0) desc, coalesce(ua.active_users, 0) desc
   limit greatest(least(p_limit, 100), 1);
$$;

create or replace function public.student_leaderboard(p_limit integer default 20)
returns table (
  user_id uuid, username text, avatar_url text,
  longest_streak integer, post_count integer, message_count integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.username, p.avatar_url, p.longest_streak, p.post_count, p.message_count
    from public.profiles p
   where p.university_id = public.current_university_id()
     and p.deleted_at is null
     -- Users who opted out are excluded entirely, including from their own view (§27).
     and not p.hide_from_leaderboard
     and p.id not in (select public.blocked_user_ids())
   order by p.longest_streak desc, p.post_count desc
   limit greatest(least(p_limit, 100), 1);
$$;

-- ---------------------------------------------------------------------------
-- Account deletion (§39)
-- ---------------------------------------------------------------------------
/*
  Deleting an account must not leave orphaned private data, and must not
  silently vandalise shared threads. We:
    - hard delete everything that is private to the user (messages, DMs,
      push tokens, notifications, votes, reactions, blocks)
    - hard delete their posts and comments (their content, their call)
    - close their streaks with an honest history reason
    - anonymise and tombstone the profile row so foreign keys stay valid
  The auth.users row is removed by the caller (an edge function using the
  service role), which cascades onto the tombstone.
*/
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  s record;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;

  -- Close streaks honestly before the rows cascade away.
  for s in select * from public.streaks
            where scope = 'direct' and uid in (user_low, user_high)
              and current_length >= 2
  loop
    insert into public.streak_history (streak_id, length, started_on, ended_on, ended_reason)
    values (s.id, s.current_length, s.started_on,
            coalesce(s.last_qualified_on, current_date), 'account_deleted');
  end loop;

  delete from public.messages where sender_id = uid;
  delete from public.message_reactions where user_id = uid;
  delete from public.reactions where user_id = uid;
  delete from public.comments where author_id = uid;
  delete from public.posts where author_id = uid;
  delete from public.poll_votes where user_id = uid;
  delete from public.daily_question_answers where user_id = uid;
  delete from public.saved_posts where user_id = uid;
  delete from public.push_tokens where user_id = uid;
  delete from public.notifications where user_id = uid or actor_id = uid;
  delete from public.blocks where blocker_id = uid or blocked_id = uid;
  delete from public.typing_indicators where user_id = uid;
  delete from public.university_daily_actives where user_id = uid;
  delete from public.conversation_members where user_id = uid;

  -- Direct conversations with no members left are private to the pair.
  delete from public.conversations c
   where c.kind = 'direct'
     and not exists (select 1 from public.conversation_members m where m.conversation_id = c.id);

  -- Tombstone rather than delete, so remaining foreign keys (e.g. a streak
  -- history row on the other person's profile) stay valid.
  update public.profiles set
    deleted_at    = now(),
    username      = 'deleted_' || substr(replace(uid::text, '-', ''), 1, 12),
    display_name  = null,
    avatar_url    = null,
    bio           = null,
    timezone      = 'UTC'
  where id = uid;
end;
$$;

revoke all on function
  public.submit_report(public.report_target, public.report_reason, uuid, uuid, uuid, uuid, uuid, text),
  public.block_user(uuid), public.unblock_user(uuid),
  public.moderate_remove_post(uuid, text),
  public.moderate_ban_user(uuid, text, interval, public.ban_scope),
  public.moderate_unban_user(uuid, text),
  public.moderate_resolve_report(uuid, public.report_status, text),
  public.campus_pulse(uuid), public.university_battle(uuid, uuid),
  public.university_leaderboard(integer), public.student_leaderboard(integer),
  public.delete_my_account()
from public, anon;

grant execute on function
  public.submit_report(public.report_target, public.report_reason, uuid, uuid, uuid, uuid, uuid, text),
  public.block_user(uuid), public.unblock_user(uuid),
  public.moderate_remove_post(uuid, text),
  public.moderate_ban_user(uuid, text, interval, public.ban_scope),
  public.moderate_unban_user(uuid, text),
  public.moderate_resolve_report(uuid, public.report_status, text),
  public.campus_pulse(uuid), public.university_battle(uuid, uuid),
  public.university_leaderboard(integer), public.student_leaderboard(integer),
  public.delete_my_account()
to authenticated;
