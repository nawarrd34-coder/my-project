-- ============================================================================
-- Authorization tests (§32).
--
-- Each block impersonates a real end user (role `authenticated` plus a JWT
-- subject claim) and asserts what they can and cannot reach. Anything that
-- passes here passes through exactly the same policy path as production.
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

create or replace function pg_temp.assert_denied(stmt text, label text)
returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    raise notice '  ok  % (denied: %)', label, sqlerrm;
    return;
  end;
  raise exception 'FAIL % : the operation was ALLOWED but should have been denied', label;
end;
$$;

/* Impersonate an end user exactly as PostgREST does. */
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

-- ---------------------------------------------------------------------------
-- Fixtures: two universities, four users, one moderator.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('aaaa0000-0000-0000-0000-00000000000a', 'ksu-a@x.edu'),
  ('bbbb0000-0000-0000-0000-00000000000b', 'ksu-b@x.edu'),
  ('cccc0000-0000-0000-0000-00000000000c', 'pnu-c@x.edu'),
  ('dddd0000-0000-0000-0000-00000000000d', 'ksu-mod@x.edu'),
  ('eeee0000-0000-0000-0000-00000000000e', 'ksu-banned@x.edu');

insert into public.profiles (id, university_id, username, username_normalized, anon_tag, role)
select 'aaaa0000-0000-0000-0000-00000000000a', id, 'ksu_a', 'ksu_a', 1111, 'student'
  from public.universities where code = 'KSU';
insert into public.profiles (id, university_id, username, username_normalized, anon_tag, role)
select 'bbbb0000-0000-0000-0000-00000000000b', id, 'ksu_b', 'ksu_b', 2222, 'student'
  from public.universities where code = 'KSU';
insert into public.profiles (id, university_id, username, username_normalized, anon_tag, role)
select 'cccc0000-0000-0000-0000-00000000000c', id, 'pnu_c', 'pnu_c', 3333, 'student'
  from public.universities where code = 'PNU';
insert into public.profiles (id, university_id, username, username_normalized, anon_tag, role)
select 'dddd0000-0000-0000-0000-00000000000d', id, 'ksu_mod', 'ksu_mod', 4444, 'moderator'
  from public.universities where code = 'KSU';
insert into public.profiles (id, university_id, username, username_normalized, anon_tag, role)
select 'eeee0000-0000-0000-0000-00000000000e', id, 'ksu_ban', 'ksu_ban', 5555, 'student'
  from public.universities where code = 'KSU';

insert into public.university_members (university_id, user_id)
select p.university_id, p.id from public.profiles p
where p.id in ('aaaa0000-0000-0000-0000-00000000000a','bbbb0000-0000-0000-0000-00000000000b',
               'cccc0000-0000-0000-0000-00000000000c','dddd0000-0000-0000-0000-00000000000d',
               'eeee0000-0000-0000-0000-00000000000e');

grant usage on schema public to authenticated;

\echo ''
\echo '== university isolation: KSU content is invisible to PNU (§9) =='
do $$
declare n bigint; ksu uuid; pnu uuid; post_id uuid;
begin
  select id into ksu from public.universities where code='KSU';
  select id into pnu from public.universities where code='PNU';

  insert into public.posts (university_id, author_id, kind, body)
  values (ksu, 'aaaa0000-0000-0000-0000-00000000000a', 'text', 'KSU only post')
  returning id into post_id;

  perform pg_temp.act_as('bbbb0000-0000-0000-0000-00000000000b');
  select count(*) into n from public.posts where id = post_id;
  perform pg_temp.assert_eq(n, 1::bigint, 'same-university peer can read the post');

  perform pg_temp.act_as('cccc0000-0000-0000-0000-00000000000c');
  select count(*) into n from public.posts where id = post_id;
  perform pg_temp.assert_eq(n, 0::bigint, 'other-university user cannot read the post');

  perform pg_temp.act_as_owner();
end $$;

\echo ''
\echo '== a user cannot post into a university they do not belong to =='
do $$
declare pnu uuid;
begin
  select id into pnu from public.universities where code='PNU';
  perform pg_temp.act_as('aaaa0000-0000-0000-0000-00000000000a');
  perform pg_temp.assert_denied(
    format('insert into public.posts (university_id, author_id, kind, body) values (%L, %L, ''text'', ''cross-post'')',
           pnu, 'aaaa0000-0000-0000-0000-00000000000a'),
    'cross-university post rejected');
  perform pg_temp.act_as_owner();
end $$;

\echo ''
\echo '== a user cannot forge authorship (§32) =='
do $$
declare ksu uuid;
begin
  select id into ksu from public.universities where code='KSU';
  perform pg_temp.act_as('aaaa0000-0000-0000-0000-00000000000a');
  perform pg_temp.assert_denied(
    format('insert into public.posts (university_id, author_id, kind, body) values (%L, %L, ''text'', ''forged'')',
           ksu, 'bbbb0000-0000-0000-0000-00000000000b'),
    'posting as someone else rejected');
  perform pg_temp.act_as_owner();
end $$;

\echo ''
\echo '== private messages are invisible to non-members (§12) =='
do $$
declare convo public.conversations; n bigint; msg public.messages;
begin
  perform pg_temp.act_as('aaaa0000-0000-0000-0000-00000000000a');
  convo := public.open_direct_conversation('bbbb0000-0000-0000-0000-00000000000b');
  msg := public.send_message(convo.id, 'a private secret');

  select count(*) into n from public.messages where conversation_id = convo.id;
  perform pg_temp.assert_eq(n, 1::bigint, 'sender sees their message');

  perform pg_temp.act_as('bbbb0000-0000-0000-0000-00000000000b');
  select count(*) into n from public.messages where conversation_id = convo.id;
  perform pg_temp.assert_eq(n, 1::bigint, 'recipient sees the message');

  -- A third party in the same university must see nothing at all.
  perform pg_temp.act_as('dddd0000-0000-0000-0000-00000000000d');
  select count(*) into n from public.messages where conversation_id = convo.id;
  perform pg_temp.assert_eq(n, 0::bigint, 'outsider sees no messages');
  select count(*) into n from public.conversations where id = convo.id;
  perform pg_temp.assert_eq(n, 0::bigint, 'outsider cannot even see the conversation');

  -- ... and cannot inject one either.
  perform pg_temp.assert_denied(
    format('select public.send_message(%L, ''intruding'')', convo.id),
    'outsider cannot send into the conversation');

  perform pg_temp.act_as_owner();
end $$;

\echo ''
\echo '== a DM opens exactly once, whoever initiates (§12) =='
do $$
declare c1 public.conversations; c2 public.conversations;
begin
  perform pg_temp.act_as('aaaa0000-0000-0000-0000-00000000000a');
  c1 := public.open_direct_conversation('bbbb0000-0000-0000-0000-00000000000b');
  perform pg_temp.act_as('bbbb0000-0000-0000-0000-00000000000b');
  c2 := public.open_direct_conversation('aaaa0000-0000-0000-0000-00000000000a');
  perform pg_temp.assert_eq(c1.id, c2.id, 'both directions resolve to one conversation');
  perform pg_temp.act_as_owner();
end $$;

\echo ''
\echo '== anonymous posts hide the author from peers but not from moderators (§24) =='
do $$
declare ksu uuid; post_id uuid; r record;
begin
  select id into ksu from public.universities where code='KSU';
  perform pg_temp.act_as('aaaa0000-0000-0000-0000-00000000000a');
  post_id := (public.create_post('who has the STAT 107 notes?', 'text', null, 'anonymous')).id;

  -- A peer reading the feed view sees no identity.
  perform pg_temp.act_as('bbbb0000-0000-0000-0000-00000000000b');
  select * into r from public.feed_posts where id = post_id;
  perform pg_temp.assert_eq(r.author_id, null::uuid, 'peer sees no author id');
  perform pg_temp.assert_eq(r.author_username, null::text, 'peer sees no username');
  perform pg_temp.assert_eq((r.author_anon_tag is not null), true, 'peer sees a stable anon tag');

  -- The author still recognises their own post.
  perform pg_temp.act_as('aaaa0000-0000-0000-0000-00000000000a');
  select * into r from public.feed_posts where id = post_id;
  perform pg_temp.assert_eq(r.is_mine, true, 'author sees it as theirs');

  -- A moderator can resolve the real author, which is what makes anonymity
  -- safe rather than a loophole.
  perform pg_temp.act_as('dddd0000-0000-0000-0000-00000000000d');
  select * into r from public.feed_posts where id = post_id;
  perform pg_temp.assert_eq(r.author_id, 'aaaa0000-0000-0000-0000-00000000000a'::uuid,
    'moderator resolves the real author');

  perform pg_temp.act_as_owner();
end $$;

\echo ''
\echo '== a banned user cannot post, message or react (§29) =='
do $$
declare ksu uuid; convo public.conversations;
begin
  select id into ksu from public.universities where code='KSU';

  insert into public.bans (user_id, scope, reason)
  values ('eeee0000-0000-0000-0000-00000000000e', 'platform', 'test ban');

  perform pg_temp.act_as('eeee0000-0000-0000-0000-00000000000e');
  perform pg_temp.assert_denied(
    'select public.create_post(''i am banned'', ''text'')',
    'banned user cannot post');
  perform pg_temp.assert_denied(
    format('insert into public.posts (university_id, author_id, kind, body) values (%L, %L, ''text'', ''direct insert'')',
           ksu, 'eeee0000-0000-0000-0000-00000000000e'),
    'banned user blocked at the table level too');
  perform pg_temp.assert_denied(
    'select public.open_direct_conversation(''aaaa0000-0000-0000-0000-00000000000a'')',
    'banned user cannot open a DM');
  perform pg_temp.act_as_owner();
end $$;

\echo ''
\echo '== a banned user cannot evade the ban by going anonymous (§24) =='
do $$
begin
  perform pg_temp.act_as('eeee0000-0000-0000-0000-00000000000e');
  perform pg_temp.assert_denied(
    'select public.create_post(''anonymous evasion'', ''text'', null, ''anonymous'')',
    'anonymity does not bypass the ban');
  perform pg_temp.act_as_owner();
end $$;

\echo ''
\echo '== blocking hides content both ways (§29) =='
do $$
declare n bigint; post_id uuid;
begin
  perform pg_temp.act_as('bbbb0000-0000-0000-0000-00000000000b');
  post_id := (public.create_post('post from B', 'text')).id;

  perform pg_temp.act_as('aaaa0000-0000-0000-0000-00000000000a');
  select count(*) into n from public.posts where id = post_id;
  perform pg_temp.assert_eq(n, 1::bigint, 'visible before the block');

  perform public.block_user('bbbb0000-0000-0000-0000-00000000000b');
  select count(*) into n from public.posts where id = post_id;
  perform pg_temp.assert_eq(n, 0::bigint, 'blocker no longer sees the blocked user''s post');

  -- And symmetrically: the blocked user loses sight of the blocker.
  perform pg_temp.act_as('bbbb0000-0000-0000-0000-00000000000b');
  select count(*) into n from public.profiles where id = 'aaaa0000-0000-0000-0000-00000000000a';
  perform pg_temp.assert_eq(n, 0::bigint, 'blocked user cannot see the blocker''s profile');

  perform pg_temp.act_as('aaaa0000-0000-0000-0000-00000000000a');
  perform public.unblock_user('bbbb0000-0000-0000-0000-00000000000b');
  perform pg_temp.act_as_owner();
end $$;

\echo ''
\echo '== streak state is not client-writable (§32/§33) =='
do $$
declare sid uuid;
begin
  select id into sid from public.streaks where scope='direct' limit 1;
  perform pg_temp.act_as('aaaa0000-0000-0000-0000-00000000000a');

  perform pg_temp.assert_denied(
    format('update public.streaks set current_length = 999 where id = %L', sid),
    'cannot inflate own streak');
  perform pg_temp.assert_denied(
    format('insert into public.streak_events (streak_id, user_id, local_day) values (%L, %L, current_date)',
           sid, 'aaaa0000-0000-0000-0000-00000000000a'),
    'cannot forge a streak event');
  perform pg_temp.assert_denied(
    'insert into public.user_badges (user_id, badge_id) values (''aaaa0000-0000-0000-0000-00000000000a'', ''streak_365'')',
    'cannot grant self a badge');

  perform pg_temp.act_as_owner();
end $$;

\echo ''
\echo '== privilege escalation is impossible (§32) =='
do $$
begin
  perform pg_temp.act_as('aaaa0000-0000-0000-0000-00000000000a');
  perform pg_temp.assert_denied(
    'update public.profiles set role = ''super_admin'' where id = ''aaaa0000-0000-0000-0000-00000000000a''',
    'cannot promote self to super admin');

  -- A moderator cannot promote themselves either.
  perform pg_temp.act_as('dddd0000-0000-0000-0000-00000000000d');
  perform pg_temp.assert_denied(
    'update public.profiles set role = ''super_admin'' where id = ''dddd0000-0000-0000-0000-00000000000d''',
    'moderator cannot self-promote');

  -- And an ordinary student cannot wield moderator powers.
  perform pg_temp.act_as('aaaa0000-0000-0000-0000-00000000000a');
  perform pg_temp.assert_denied(
    'select public.moderate_ban_user(''bbbb0000-0000-0000-0000-00000000000b'', ''abuse of power'')',
    'student cannot ban anyone');
  perform pg_temp.act_as_owner();
end $$;

\echo ''
\echo '== a moderator can act, and every action is audited (§30) =='
do $$
declare post_id uuid; n bigint; removed timestamptz;
begin
  perform pg_temp.act_as('bbbb0000-0000-0000-0000-00000000000b');
  post_id := (public.create_post('rule breaking post', 'text')).id;

  perform pg_temp.act_as('dddd0000-0000-0000-0000-00000000000d');
  perform public.moderate_remove_post(post_id, 'violates community rules');

  perform pg_temp.act_as_owner();
  select removed_at into removed from public.posts where id = post_id;
  perform pg_temp.assert_eq((removed is not null), true, 'post was removed');

  select count(*) into n from public.admin_actions
   where target_id = post_id and action = 'remove_content';
  perform pg_temp.assert_eq(n, 1::bigint, 'the removal was audited');

  -- Peers no longer see it; the author still does, so the removal is honest.
  perform pg_temp.act_as('aaaa0000-0000-0000-0000-00000000000a');
  select count(*) into n from public.posts where id = post_id;
  perform pg_temp.assert_eq(n, 0::bigint, 'peers no longer see removed content');
  perform pg_temp.act_as('bbbb0000-0000-0000-0000-00000000000b');
  select count(*) into n from public.posts where id = post_id;
  perform pg_temp.assert_eq(n, 1::bigint, 'the author still sees their removed post');

  perform pg_temp.act_as_owner();
end $$;

\echo ''
\echo '== leaderboard opt-out is honoured (§27) =='
do $$
declare n bigint;
begin
  perform pg_temp.act_as('aaaa0000-0000-0000-0000-00000000000a');
  update public.profiles set hide_from_leaderboard = true
   where id = 'aaaa0000-0000-0000-0000-00000000000a';

  select count(*) into n from public.student_leaderboard(50)
   where user_id = 'aaaa0000-0000-0000-0000-00000000000a';
  perform pg_temp.assert_eq(n, 0::bigint, 'hidden user is absent from the leaderboard');
  perform pg_temp.act_as_owner();
end $$;

\echo ''
\echo '== notifications are strictly per-user =='
do $$
declare n bigint;
begin
  insert into public.notifications (user_id, kind, title_key)
  values ('aaaa0000-0000-0000-0000-00000000000a', 'new_message', 'notifications.newMessage');

  perform pg_temp.act_as('bbbb0000-0000-0000-0000-00000000000b');
  select count(*) into n from public.notifications
   where user_id = 'aaaa0000-0000-0000-0000-00000000000a';
  perform pg_temp.assert_eq(n, 0::bigint, 'cannot read another user''s notifications');
  perform pg_temp.act_as_owner();
end $$;

\echo ''
\echo '== account deletion leaves no private data behind (§39) =='
do $$
declare n bigint; uid uuid := 'eeee0000-0000-0000-0000-00000000000e';
begin
  perform pg_temp.act_as_owner();
  update public.bans set lifted_at = now() where user_id = uid;

  perform pg_temp.act_as(uid);
  perform public.send_message(
    (public.open_direct_conversation('aaaa0000-0000-0000-0000-00000000000a')).id,
    'something private');
  perform public.create_post('a post to be deleted', 'text');

  perform public.delete_my_account();

  perform pg_temp.act_as_owner();
  select count(*) into n from public.messages where sender_id = uid;
  perform pg_temp.assert_eq(n, 0::bigint, 'messages removed');
  select count(*) into n from public.posts where author_id = uid;
  perform pg_temp.assert_eq(n, 0::bigint, 'posts removed');
  select count(*) into n from public.push_tokens where user_id = uid;
  perform pg_temp.assert_eq(n, 0::bigint, 'push tokens removed');
  select count(*) into n from public.conversation_members where user_id = uid;
  perform pg_temp.assert_eq(n, 0::bigint, 'conversation membership removed');

  select count(*) into n from public.profiles where id = uid and deleted_at is not null;
  perform pg_temp.assert_eq(n, 1::bigint, 'profile tombstoned, not orphaned');
  select count(*) into n from public.profiles where id = uid and username like 'deleted_%';
  perform pg_temp.assert_eq(n, 1::bigint, 'identity scrubbed from the tombstone');
end $$;

rollback;

\echo ''
\echo '=== authorization: all assertions passed ==='
