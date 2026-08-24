-- ============================================================================
-- Server-owned column tests.
--
-- Two properties must hold together, and they pull against each other:
--
--   1. a client cannot forge a derived column (rank, counter, approval flag)
--   2. the engine can still maintain those same columns
--
-- Guarding (1) without checking (2) silently breaks every counter in the app,
-- because trigger and security-definer code still runs with the end user's
-- auth.uid(). Both directions are asserted here.
-- ============================================================================

\set ON_ERROR_STOP on
set client_min_messages to notice;

create or replace function pg_temp.assert_eq(actual anyelement, expected anyelement, label text)
returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL % : expected %, got %', label, expected, actual;
  end if;
  raise notice '  ok  %', label;
end;
$$;

create or replace function pg_temp.act_as(p_user uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
end;
$$;

create or replace function pg_temp.act_as_owner()
returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
end;
$$;

begin;

insert into auth.users (id, email) values
  ('99990000-0000-0000-0000-000000000001', 'writer@x.edu'),
  ('99990000-0000-0000-0000-000000000002', 'reader@x.edu');

insert into public.profiles (id, university_id, username, username_normalized, anon_tag)
select '99990000-0000-0000-0000-000000000001', id, 'writer', 'writer', 1234
  from public.universities where code = 'KSU';
insert into public.profiles (id, university_id, username, username_normalized, anon_tag)
select '99990000-0000-0000-0000-000000000002', id, 'reader', 'reader', 1235
  from public.universities where code = 'KSU';
insert into public.university_members (university_id, user_id)
select university_id, id from public.profiles
 where id in ('99990000-0000-0000-0000-000000000001','99990000-0000-0000-0000-000000000002');

grant usage on schema public to authenticated;

\echo ''
\echo '== the engine still maintains every counter =='
do $$
declare
  ch uuid; pid uuid;
  posts_before integer; posts_after integer;
  ch_before integer; ch_after integer;
  reactions integer; comments integer; messages integer;
begin
  select id into ch from public.channels
   where slug = 'general'
     and university_id = (select university_id from public.profiles
                           where id = '99990000-0000-0000-0000-000000000001');

  select post_count into posts_before from public.profiles
   where id = '99990000-0000-0000-0000-000000000001';
  select post_count into ch_before from public.channels where id = ch;

  perform pg_temp.act_as('99990000-0000-0000-0000-000000000001');
  pid := (public.create_post('a genuine post', 'text', ch)).id;
  perform pg_temp.act_as_owner();

  select post_count into posts_after from public.profiles
   where id = '99990000-0000-0000-0000-000000000001';
  select post_count into ch_after from public.channels where id = ch;

  perform pg_temp.assert_eq(posts_after, posts_before + 1, 'profiles.post_count increments');
  perform pg_temp.assert_eq(ch_after, ch_before + 1, 'channels.post_count increments');

  -- Reactions
  perform pg_temp.act_as('99990000-0000-0000-0000-000000000002');
  perform public.toggle_post_reaction(pid, '🔥');
  perform pg_temp.act_as_owner();
  select reaction_count into reactions from public.posts where id = pid;
  perform pg_temp.assert_eq(reactions, 1, 'posts.reaction_count increments');

  -- ... and removing the reaction decrements again.
  perform pg_temp.act_as('99990000-0000-0000-0000-000000000002');
  perform public.toggle_post_reaction(pid, '🔥');
  perform pg_temp.act_as_owner();
  select reaction_count into reactions from public.posts where id = pid;
  perform pg_temp.assert_eq(reactions, 0, 'posts.reaction_count decrements');

  -- Comments
  perform pg_temp.act_as('99990000-0000-0000-0000-000000000002');
  insert into public.comments (post_id, author_id, body)
  values (pid, '99990000-0000-0000-0000-000000000002', 'nice');
  perform pg_temp.act_as_owner();
  select comment_count into comments from public.posts where id = pid;
  perform pg_temp.assert_eq(comments, 1, 'posts.comment_count increments');

  -- Messages
  perform pg_temp.act_as('99990000-0000-0000-0000-000000000001');
  perform public.send_message(
    (public.open_direct_conversation('99990000-0000-0000-0000-000000000002')).id, 'hello');
  perform pg_temp.act_as_owner();
  select message_count into messages from public.profiles
   where id = '99990000-0000-0000-0000-000000000001';
  perform pg_temp.assert_eq(messages, 1, 'profiles.message_count increments');
end $$;

\echo ''
\echo '== a client cannot forge post ranking or engagement =='
do $$
declare ksu uuid; pid uuid; row_after public.posts;
begin
  select id into ksu from public.universities where code = 'KSU';

  perform pg_temp.act_as('99990000-0000-0000-0000-000000000001');
  insert into public.posts (university_id, author_id, kind, body,
                            is_pinned, hot_score, reaction_count, comment_count)
  values (ksu, '99990000-0000-0000-0000-000000000001', 'text', 'promote me',
          true, 999999, 500000, 500000)
  returning id into pid;
  perform pg_temp.act_as_owner();

  select * into row_after from public.posts where id = pid;
  perform pg_temp.assert_eq(row_after.is_pinned, false, 'cannot self-pin a post');
  perform pg_temp.assert_eq(row_after.hot_score, 0::double precision, 'cannot set hot_score');
  perform pg_temp.assert_eq(row_after.reaction_count, 0, 'cannot fake reaction_count');
  perform pg_temp.assert_eq(row_after.comment_count, 0, 'cannot fake comment_count');

  -- ... nor by updating afterwards.
  perform pg_temp.act_as('99990000-0000-0000-0000-000000000001');
  update public.posts set is_pinned = true, hot_score = 12345, reaction_count = 999
   where id = pid;
  perform pg_temp.act_as_owner();

  select * into row_after from public.posts where id = pid;
  perform pg_temp.assert_eq(row_after.is_pinned, false, 'cannot pin via update');
  perform pg_temp.assert_eq(row_after.hot_score, 0::double precision, 'cannot raise hot_score via update');
  perform pg_temp.assert_eq(row_after.reaction_count, 0, 'cannot raise reaction_count via update');
end $$;

\echo ''
\echo '== a client cannot forge their own profile stats (§27 leaderboard) =='
do $$
declare me public.profiles;
begin
  perform pg_temp.act_as('99990000-0000-0000-0000-000000000001');
  update public.profiles
     set longest_streak = 9999, post_count = 9999, message_count = 9999
   where id = '99990000-0000-0000-0000-000000000001';
  perform pg_temp.act_as_owner();

  select * into me from public.profiles where id = '99990000-0000-0000-0000-000000000001';
  perform pg_temp.assert_eq(me.longest_streak, 0, 'cannot fake longest_streak');
  perform pg_temp.assert_eq((me.post_count < 100), true, 'cannot fake post_count');
  perform pg_temp.assert_eq((me.message_count < 100), true, 'cannot fake message_count');
end $$;

\echo ''
\echo '== a client cannot move themselves to another university =='
do $$
declare pnu uuid; me public.profiles; original uuid;
begin
  select id into pnu from public.universities where code = 'PNU';
  select university_id into original from public.profiles
   where id = '99990000-0000-0000-0000-000000000001';

  perform pg_temp.act_as('99990000-0000-0000-0000-000000000001');
  update public.profiles set university_id = pnu
   where id = '99990000-0000-0000-0000-000000000001';
  perform pg_temp.act_as_owner();

  select * into me from public.profiles where id = '99990000-0000-0000-0000-000000000001';
  perform pg_temp.assert_eq(me.university_id, original, 'university_id is not self-assignable');
end $$;

\echo ''
\echo '== a client cannot self-approve a sound (§23 moderation) =='
do $$
declare ksu uuid; sid uuid; approved boolean; uses integer;
begin
  select id into ksu from public.universities where code = 'KSU';

  perform pg_temp.act_as('99990000-0000-0000-0000-000000000001');
  insert into public.sounds (uploader_id, university_id, title, storage_path,
                             duration_ms, is_approved, use_count)
  values ('99990000-0000-0000-0000-000000000001', ksu, 'my clip', 'p/x.m4a',
          3000, true, 9999)
  returning id into sid;
  perform pg_temp.act_as_owner();

  select is_approved, use_count into approved, uses from public.sounds where id = sid;
  perform pg_temp.assert_eq(approved, false, 'upload is not self-approved');
  perform pg_temp.assert_eq(uses, 0, 'cannot fake use_count');
end $$;

rollback;

\echo ''
\echo '=== server-owned columns: all assertions passed ==='
