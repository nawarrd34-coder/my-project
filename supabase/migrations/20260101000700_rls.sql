-- ============================================================================
-- Uni Streak :: 0007 row level security
-- ============================================================================
-- Default posture: RLS on for every table, no policy = no access. Anything
-- reachable by the anon key is listed explicitly.
--
-- Reads are scoped by university membership; writes are scoped to the acting
-- user and additionally gated on `not public.is_banned()`.
-- ============================================================================

alter table public.universities            enable row level security;
alter table public.profiles                enable row level security;
alter table public.university_members      enable row level security;
alter table public.blocks                  enable row level security;
alter table public.bans                    enable row level security;
alter table public.channels                enable row level security;
alter table public.sounds                  enable row level security;
alter table public.posts                   enable row level security;
alter table public.post_media              enable row level security;
alter table public.comments                enable row level security;
alter table public.reactions               enable row level security;
alter table public.saved_posts             enable row level security;
alter table public.poll_options            enable row level security;
alter table public.poll_votes              enable row level security;
alter table public.conversations           enable row level security;
alter table public.conversation_members    enable row level security;
alter table public.messages                enable row level security;
alter table public.message_reactions       enable row level security;
alter table public.typing_indicators       enable row level security;
alter table public.streaks                 enable row level security;
alter table public.streak_events           enable row level security;
alter table public.streak_history          enable row level security;
alter table public.university_activity     enable row level security;
alter table public.university_daily_actives enable row level security;
alter table public.daily_questions         enable row level security;
alter table public.daily_question_options  enable row level security;
alter table public.daily_question_answers  enable row level security;
alter table public.badges                  enable row level security;
alter table public.user_badges             enable row level security;
alter table public.notifications           enable row level security;
alter table public.notification_settings   enable row level security;
alter table public.push_tokens             enable row level security;
alter table public.reports                 enable row level security;
alter table public.admin_actions           enable row level security;
alter table public.rate_limits             enable row level security;
alter table public.app_settings            enable row level security;

-- ---------------------------------------------------------------------------
-- universities: public catalogue (needed on the onboarding screen, before the
-- user has an account), admin-managed.
-- ---------------------------------------------------------------------------
create policy universities_read on public.universities
  for select to anon, authenticated using (is_active or public.is_super_admin());

create policy universities_admin_write on public.universities
  for all to authenticated
  using (public.is_university_admin_of(id))
  with check (public.is_university_admin_of(id));

create policy universities_super_insert on public.universities
  for insert to authenticated with check (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
-- Readable by anyone in the same university (so feeds and search resolve
-- authors), plus always your own row. Blocked users are filtered out.
create policy profiles_read on public.profiles
  for select to authenticated
  using (
    deleted_at is null
    and (
      id = auth.uid()
      or (
        university_id = public.current_university_id()
        and not public.has_block_between(id)
      )
      or public.is_moderator_of(university_id)
    )
  );

create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (id = auth.uid());

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Moderators may update profiles in their university (e.g. clearing an
-- abusive bio) but the `role` column is separately protected by a trigger.
create policy profiles_update_moderator on public.profiles
  for update to authenticated
  using (public.is_moderator_of(university_id))
  with check (public.is_moderator_of(university_id));

-- ---------------------------------------------------------------------------
-- university_members
-- ---------------------------------------------------------------------------
create policy university_members_read on public.university_members
  for select to authenticated
  using (user_id = auth.uid() or public.can_see_university(university_id));

create policy university_members_join_self on public.university_members
  for insert to authenticated
  with check (user_id = auth.uid() and not public.is_banned());

create policy university_members_leave_self on public.university_members
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- blocks: strictly private to the blocker.
-- ---------------------------------------------------------------------------
create policy blocks_read_own on public.blocks
  for select to authenticated using (blocker_id = auth.uid());

create policy blocks_insert_own on public.blocks
  for insert to authenticated with check (blocker_id = auth.uid());

create policy blocks_delete_own on public.blocks
  for delete to authenticated using (blocker_id = auth.uid());

-- ---------------------------------------------------------------------------
-- bans: a user may see their own ban (to render the restriction notice);
-- only moderators may create or lift one.
-- ---------------------------------------------------------------------------
create policy bans_read_own on public.bans
  for select to authenticated
  using (user_id = auth.uid() or public.is_moderator_of(coalesce(university_id, public.current_university_id())));

create policy bans_moderator_write on public.bans
  for all to authenticated
  using (public.is_moderator_of(coalesce(university_id, public.current_university_id())))
  with check (public.is_moderator_of(coalesce(university_id, public.current_university_id())));

-- ---------------------------------------------------------------------------
-- channels
-- ---------------------------------------------------------------------------
create policy channels_read on public.channels
  for select to authenticated
  using (is_active and public.can_see_university(university_id));

create policy channels_admin_write on public.channels
  for all to authenticated
  using (public.is_university_admin_of(university_id))
  with check (public.is_university_admin_of(university_id));

-- ---------------------------------------------------------------------------
-- sounds
-- ---------------------------------------------------------------------------
create policy sounds_read on public.sounds
  for select to authenticated
  using (
    not is_removed
    and (university_id is null or public.can_see_university(university_id))
    and (is_approved or uploader_id = auth.uid() or public.is_moderator_of(university_id))
  );

create policy sounds_insert_own on public.sounds
  for insert to authenticated
  with check (uploader_id = auth.uid() and not public.is_banned());

create policy sounds_moderate on public.sounds
  for update to authenticated
  using (public.is_moderator_of(university_id))
  with check (public.is_moderator_of(university_id));

-- ---------------------------------------------------------------------------
-- posts
-- ---------------------------------------------------------------------------
-- NOTE: this policy governs the *row*, including `author_id`. Anonymity is
-- enforced at the projection layer (`public.feed_posts` view), never here -
-- moderators must still be able to resolve the author (§24).
create policy posts_read on public.posts
  for select to authenticated
  using (
    deleted_at is null
    and public.can_see_university(university_id)
    and (
      removed_at is null
      or author_id = auth.uid()
      or public.is_moderator_of(university_id)
    )
    and author_id not in (select public.blocked_user_ids())
  );

create policy posts_insert_own on public.posts
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and not public.is_banned()
    and public.can_see_university(university_id)
    -- Cannot post into a read-only channel unless you administer it.
    and (
      channel_id is null
      or exists (
        select 1 from public.channels c
        where c.id = channel_id
          and c.university_id = posts.university_id
          and c.is_active
          and (not c.is_read_only or public.is_university_admin_of(c.university_id))
      )
    )
  );

create policy posts_update_own on public.posts
  for update to authenticated
  using (author_id = auth.uid() and deleted_at is null)
  with check (author_id = auth.uid());

create policy posts_moderate on public.posts
  for update to authenticated
  using (public.is_moderator_of(university_id))
  with check (public.is_moderator_of(university_id));

create policy posts_delete_own on public.posts
  for delete to authenticated using (author_id = auth.uid());

-- ---------------------------------------------------------------------------
-- post_media / poll options: visibility follows the parent post.
-- ---------------------------------------------------------------------------
create policy post_media_read on public.post_media
  for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));

create policy post_media_write_own on public.post_media
  for all to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()))
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));

create policy poll_options_read on public.poll_options
  for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));

create policy poll_options_write_own on public.poll_options
  for all to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()))
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));

-- Votes are private in detail but aggregated publicly via `poll_options.vote_count`.
create policy poll_votes_read_own on public.poll_votes
  for select to authenticated using (user_id = auth.uid());

create policy poll_votes_insert_own on public.poll_votes
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and not public.is_banned()
    and exists (select 1 from public.posts p where p.id = post_id)
  );

create policy poll_votes_delete_own on public.poll_votes
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- comments
-- ---------------------------------------------------------------------------
create policy comments_read on public.comments
  for select to authenticated
  using (
    deleted_at is null
    and exists (select 1 from public.posts p where p.id = post_id)
    and (removed_at is null or author_id = auth.uid())
    and author_id not in (select public.blocked_user_ids())
  );

create policy comments_insert_own on public.comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and not public.is_banned()
    and exists (select 1 from public.posts p where p.id = post_id and p.removed_at is null)
  );

create policy comments_update_own on public.comments
  for update to authenticated
  using (author_id = auth.uid() and deleted_at is null)
  with check (author_id = auth.uid());

create policy comments_delete_own on public.comments
  for delete to authenticated using (author_id = auth.uid());

create policy comments_moderate on public.comments
  for update to authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_id and public.is_moderator_of(p.university_id)
    )
  )
  with check (
    exists (
      select 1 from public.posts p
      where p.id = post_id and public.is_moderator_of(p.university_id)
    )
  );

-- ---------------------------------------------------------------------------
-- reactions
-- ---------------------------------------------------------------------------
create policy reactions_read on public.reactions
  for select to authenticated
  using (
    (post_id is not null and exists (select 1 from public.posts p where p.id = post_id))
    or (comment_id is not null and exists (select 1 from public.comments c where c.id = comment_id))
  );

create policy reactions_insert_own on public.reactions
  for insert to authenticated
  with check (user_id = auth.uid() and not public.is_banned());

create policy reactions_update_own on public.reactions
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy reactions_delete_own on public.reactions
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- saved_posts: entirely private.
-- ---------------------------------------------------------------------------
create policy saved_posts_own on public.saved_posts
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- conversations & messages  (§12: never expose private messages)
-- ---------------------------------------------------------------------------
create policy conversations_read on public.conversations
  for select to authenticated
  using (
    public.is_conversation_member(id)
    -- Public groups are discoverable in search before you join.
    or (kind = 'group' and is_public and public.can_see_university(university_id))
  );

create policy conversations_insert on public.conversations
  for insert to authenticated
  with check (created_by = auth.uid() and not public.is_banned());

create policy conversations_update_admin on public.conversations
  for update to authenticated
  using (public.is_conversation_admin(id))
  with check (public.is_conversation_admin(id));

create policy conversation_members_read on public.conversation_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_conversation_member(conversation_id));

-- You may add yourself to a public group, or an admin may add anyone.
create policy conversation_members_insert on public.conversation_members
  for insert to authenticated
  with check (
    not public.is_banned()
    and (
      (
        user_id = auth.uid()
        and exists (
          select 1 from public.conversations c
          where c.id = conversation_id
            and (
              c.is_public
              -- The creator seeds their own membership at creation time.
              or c.created_by = auth.uid()
            )
        )
      )
      or public.is_conversation_admin(conversation_id)
    )
  );

create policy conversation_members_update_self on public.conversation_members
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy conversation_members_update_admin on public.conversation_members
  for update to authenticated
  using (public.is_conversation_admin(conversation_id))
  with check (public.is_conversation_admin(conversation_id));

create policy conversation_members_delete on public.conversation_members
  for delete to authenticated
  using (user_id = auth.uid() or public.is_conversation_admin(conversation_id));

create policy messages_read on public.messages
  for select to authenticated
  using (
    deleted_at is null
    and public.is_conversation_member(conversation_id)
    and sender_id not in (select public.blocked_user_ids())
  );

create policy messages_insert_own on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and not public.is_banned()
    and public.is_conversation_member(conversation_id)
  );

create policy messages_update_own on public.messages
  for update to authenticated
  using (sender_id = auth.uid() and deleted_at is null)
  with check (sender_id = auth.uid());

create policy messages_delete_own on public.messages
  for delete to authenticated using (sender_id = auth.uid());

create policy message_reactions_read on public.message_reactions
  for select to authenticated
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_id and public.is_conversation_member(m.conversation_id)
    )
  );

create policy message_reactions_write_own on public.message_reactions
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and not public.is_banned()
    and exists (
      select 1 from public.messages m
      where m.id = message_id and public.is_conversation_member(m.conversation_id)
    )
  );

create policy typing_indicators_read on public.typing_indicators
  for select to authenticated using (public.is_conversation_member(conversation_id));

create policy typing_indicators_write_own on public.typing_indicators
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_conversation_member(conversation_id));

-- ---------------------------------------------------------------------------
-- streaks: readable by participants only; NEVER writable from the client.
-- All mutations go through the engine's security-definer functions (§32/§33).
-- ---------------------------------------------------------------------------
create policy streaks_read on public.streaks
  for select to authenticated
  using (
    (scope = 'direct' and auth.uid() in (user_low, user_high))
    or (scope = 'university' and public.can_see_university(university_id))
  );

create policy streak_events_read on public.streak_events
  for select to authenticated
  using (
    exists (
      select 1 from public.streaks s
      where s.id = streak_id and auth.uid() in (s.user_low, s.user_high)
    )
  );

create policy streak_history_read on public.streak_history
  for select to authenticated
  using (
    exists (
      select 1 from public.streaks s
      where s.id = streak_id
        and (
          auth.uid() in (s.user_low, s.user_high)
          or (s.scope = 'university' and public.can_see_university(s.university_id))
        )
    )
  );

-- University-level rollups are public to that university.
create policy university_activity_read on public.university_activity
  for select to authenticated using (public.can_see_university(university_id));

-- Individual daily-active rows would leak "who was online when", so they are
-- readable only by the user themselves.
create policy university_daily_actives_read_own on public.university_daily_actives
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- daily questions
-- ---------------------------------------------------------------------------
create policy daily_questions_read on public.daily_questions
  for select to authenticated using (public.can_see_university(university_id));

create policy daily_questions_admin_write on public.daily_questions
  for all to authenticated
  using (public.is_university_admin_of(university_id))
  with check (public.is_university_admin_of(university_id));

create policy dq_options_read on public.daily_question_options
  for select to authenticated
  using (exists (select 1 from public.daily_questions q where q.id = question_id));

create policy dq_options_admin_write on public.daily_question_options
  for all to authenticated
  using (
    exists (
      select 1 from public.daily_questions q
      where q.id = question_id and public.is_university_admin_of(q.university_id)
    )
  )
  with check (
    exists (
      select 1 from public.daily_questions q
      where q.id = question_id and public.is_university_admin_of(q.university_id)
    )
  );

create policy dq_answers_read_own on public.daily_question_answers
  for select to authenticated using (user_id = auth.uid());

create policy dq_answers_insert_own on public.daily_question_answers
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and not public.is_banned()
    and exists (
      select 1 from public.daily_questions q
      where q.id = question_id and q.closes_at > now()
        and public.can_see_university(q.university_id)
    )
  );

-- ---------------------------------------------------------------------------
-- badges: catalogue is public; awards are read-only to clients.
-- ---------------------------------------------------------------------------
create policy badges_read on public.badges
  for select to authenticated using (is_active);

create policy user_badges_read on public.user_badges
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = user_badges.user_id
        and p.university_id = public.current_university_id()
        and not public.has_block_between(p.id)
    )
  );

-- ---------------------------------------------------------------------------
-- notifications & push tokens: strictly per-user.
-- ---------------------------------------------------------------------------
create policy notifications_read_own on public.notifications
  for select to authenticated using (user_id = auth.uid());

-- Clients may only mark as read; inserts come from the server.
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy notifications_delete_own on public.notifications
  for delete to authenticated using (user_id = auth.uid());

create policy notification_settings_own on public.notification_settings
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy push_tokens_own on public.push_tokens
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- reports: a reporter sees only their own; moderators see their university's.
-- ---------------------------------------------------------------------------
create policy reports_read on public.reports
  for select to authenticated
  using (
    reporter_id = auth.uid()
    or public.is_moderator_of(coalesce(university_id, public.current_university_id()))
  );

create policy reports_insert_own on public.reports
  for insert to authenticated
  with check (reporter_id = auth.uid() and not public.is_banned());

create policy reports_moderate on public.reports
  for update to authenticated
  using (public.is_moderator_of(coalesce(university_id, public.current_university_id())))
  with check (public.is_moderator_of(coalesce(university_id, public.current_university_id())));

-- ---------------------------------------------------------------------------
-- admin_actions: append-only audit log, visible to moderators.
-- ---------------------------------------------------------------------------
create policy admin_actions_read on public.admin_actions
  for select to authenticated
  using (public.is_moderator_of(coalesce(university_id, public.current_university_id())));

-- ---------------------------------------------------------------------------
-- rate_limits: server-managed. Users may read their own for UI feedback.
-- ---------------------------------------------------------------------------
create policy rate_limits_read_own on public.rate_limits
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- app_settings: readable by all authenticated users, writable by super admins.
-- ---------------------------------------------------------------------------
create policy app_settings_read on public.app_settings
  for select to authenticated using (true);

create policy app_settings_write on public.app_settings
  for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- Table-level grants. RLS filters rows; grants gate the verbs. Note that no
-- role is granted INSERT/UPDATE/DELETE on streaks, streak_events,
-- streak_history, university_activity, badges or admin_actions - those are
-- written exclusively by security-definer functions (§32).
-- ---------------------------------------------------------------------------
grant select on
  public.universities, public.profiles, public.university_members, public.channels,
  public.sounds, public.posts, public.post_media, public.comments, public.reactions,
  public.poll_options, public.poll_votes, public.saved_posts, public.conversations,
  public.conversation_members, public.messages, public.message_reactions,
  public.typing_indicators, public.streaks, public.streak_events, public.streak_history,
  public.university_activity, public.university_daily_actives, public.daily_questions,
  public.daily_question_options, public.daily_question_answers, public.badges,
  public.user_badges, public.notifications, public.notification_settings,
  public.push_tokens, public.reports, public.admin_actions, public.rate_limits,
  public.app_settings, public.blocks, public.bans
to authenticated;

grant select on public.universities to anon;

grant insert, update, delete on
  public.profiles, public.university_members, public.blocks, public.posts,
  public.post_media, public.comments, public.reactions, public.saved_posts,
  public.poll_options, public.poll_votes, public.conversations,
  public.conversation_members, public.messages, public.message_reactions,
  public.typing_indicators, public.daily_question_answers, public.push_tokens,
  public.notification_settings, public.reports, public.sounds
to authenticated;

grant update, delete on public.notifications to authenticated;
grant insert, update on public.bans, public.channels, public.daily_questions,
  public.daily_question_options, public.universities, public.app_settings to authenticated;
