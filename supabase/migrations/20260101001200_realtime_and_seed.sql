-- ============================================================================
-- Uni Streak :: 0012 realtime publication, badge catalogue, base data
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Realtime (§9/§11/§12). Only tables the client actually subscribes to are
-- published; RLS still applies to every realtime message.
-- ---------------------------------------------------------------------------
do $$
begin
  execute 'alter publication supabase_realtime add table public.messages';
  execute 'alter publication supabase_realtime add table public.message_reactions';
  execute 'alter publication supabase_realtime add table public.reactions';
  execute 'alter publication supabase_realtime add table public.posts';
  execute 'alter publication supabase_realtime add table public.comments';
  execute 'alter publication supabase_realtime add table public.typing_indicators';
  execute 'alter publication supabase_realtime add table public.streaks';
  execute 'alter publication supabase_realtime add table public.notifications';
exception when duplicate_object then
  null;
end $$;

-- Realtime UPDATE/DELETE payloads only carry the primary key unless the table
-- has REPLICA IDENTITY FULL. Chat reactions and streak changes need the old
-- row to reconcile the cache.
alter table public.messages replica identity full;
alter table public.reactions replica identity full;
alter table public.message_reactions replica identity full;
alter table public.streaks replica identity full;

-- ---------------------------------------------------------------------------
-- Badge catalogue (§26)
-- ---------------------------------------------------------------------------
insert into public.badges (id, emoji, name_key, rule_kind, rule_value, sort_order) values
  ('streak_7',          '🔥', 'badges.streak7',         'streak_length',  7,  10),
  ('streak_30',         '🔥', 'badges.streak30',        'streak_length',  30, 20),
  ('streak_100',        '🔥', 'badges.streak100',       'streak_length',  100, 30),
  ('streak_365',        '🔥', 'badges.streak365',       'streak_length',  365, 40),
  ('first_week',        '🎓', 'badges.firstWeek',       'days_since_join', 7, 50),
  ('most_active',       '⚡', 'badges.mostActive',      'manual',         null, 60),
  ('messages_100',      '💬', 'badges.messages100',     'message_count',  100, 70),
  ('streak_starter',    '🔥', 'badges.streakStarter',   'streak_length',  2,  5),
  ('community_legend',  '👑', 'badges.communityLegend', 'manual',         null, 80)
on conflict (id) do update set
  emoji = excluded.emoji, name_key = excluded.name_key,
  rule_kind = excluded.rule_kind, rule_value = excluded.rule_value,
  sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- Global settings
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value) values
  ('streak.restore_window_hours', '24'::jsonb),
  ('streak.reminder_lead_hours', '4'::jsonb),
  ('sounds.max_duration_ms', '30000'::jsonb),
  ('media.max_image_bytes', '8388608'::jsonb),
  ('media.max_video_bytes', '52428800'::jsonb),
  ('feed.page_size', '20'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Launch universities (§1). Adding more is a single insert plus channels;
-- `seed_default_channels` keeps that to one call.
-- ---------------------------------------------------------------------------
create or replace function app_private.seed_default_channels(p_university uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.channels (university_id, slug, name_en, name_ar, icon, sort_order)
  values
    (p_university, 'general',   'General',   'عام',            'chatbubbles',      10),
    (p_university, 'study',     'Study',     'المذاكرة',        'book',             20),
    (p_university, 'exams',     'Exams',     'الاختبارات',      'school',           30),
    (p_university, 'courses',   'Courses',   'المقررات',        'library',          40),
    (p_university, 'campus',    'Campus',    'الحرم الجامعي',   'business',         50),
    (p_university, 'memes',     'Memes',     'الميمز',          'happy',            60),
    (p_university, 'random',    'Random',    'منوّع',           'shuffle',          70),
    (p_university, 'events',    'Events',    'الفعاليات',       'calendar',         80),
    (p_university, 'questions', 'Questions', 'أسئلة',           'help-circle',      90)
  on conflict (university_id, slug) do nothing;
end;
$$;

do $$
declare uni_id uuid;
begin
  for uni_id in
    insert into public.universities
      (code, name_en, name_ar, short_name_en, short_name_ar, timezone, brand_color, streak_threshold)
    values
      ('KSU', 'King Saud University', 'جامعة الملك سعود',
       'KSU', 'الملك سعود', 'Asia/Riyadh', '#1B6B4A', 250),
      ('PNU', 'Princess Nourah bint Abdulrahman University', 'جامعة الأميرة نورة بنت عبدالرحمن',
       'PNU', 'الأميرة نورة', 'Asia/Riyadh', '#7C4DFF', 200),
      ('IMAMU', 'Imam Mohammad Ibn Saud Islamic University', 'جامعة الإمام محمد بن سعود الإسلامية',
       'IMAMU', 'الإمام', 'Asia/Riyadh', '#0F5C8C', 200)
    on conflict (code) do nothing
    returning id
  loop
    perform app_private.seed_default_channels(uni_id);
  end loop;
end $$;
