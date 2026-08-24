/**
 * Push dispatch for in-app notifications.
 *
 * Called by a database webhook on INSERT into `public.notifications`, so the
 * app never sends its own pushes: whatever the server decided is notable is
 * exactly what is delivered (§28).
 *
 * The notification row stores an i18n key plus params rather than rendered
 * text, so the copy is resolved here against the recipient's own locale (§4).
 */
import { assertCronAuthorized, jsonResponse, serviceClient } from '../_shared/supabase.ts';
import { sendPushMessages, type PushMessage } from '../_shared/expo-push.ts';

interface NotificationRecord {
  id: string;
  user_id: string;
  kind: string;
  title_key: string;
  body_key: string | null;
  params: Record<string, unknown>;
  link: string | null;
}

/** Which per-user switch governs each notification kind (§28). */
const SETTING_FOR_KIND: Record<string, string> = {
  streak_waiting: 'streaks',
  streak_expiring: 'streaks',
  streak_milestone: 'streaks',
  new_message: 'messages',
  post_reaction: 'reactions',
  post_reply: 'comments',
  daily_question: 'daily_question',
  university_trending: 'university_activity',
  badge_earned: 'streaks',
};

/**
 * Minimal server-side copy of the strings push needs. The app carries the full
 * locale files; only these few lines are ever rendered outside it.
 */
const COPY: Record<string, Record<string, string>> = {
  en: {
    'notifications.streakWaiting': 'Your streak with {{name}} is waiting.',
    'notifications.streakExpiring': 'Your {{count}} day streak expires soon.',
    'notifications.postReply': 'Someone replied to your post.',
    'notifications.postReaction': 'Someone reacted to your post.',
    'notifications.newDailyQuestion': 'New question of the day.',
    'notifications.universityTrending': '{{university}} is trending right now.',
    'notifications.newMessage': 'New message from {{name}}',
    'notifications.badgeEarned': 'You earned a new badge.',
  },
  ar: {
    'notifications.streakWaiting': 'ستريكك مع {{name}} في انتظارك.',
    'notifications.streakExpiring': 'ستريكك البالغ {{count}} يومًا سينتهي قريبًا.',
    'notifications.postReply': 'رد أحدهم على منشورك.',
    'notifications.postReaction': 'تفاعل أحدهم مع منشورك.',
    'notifications.newDailyQuestion': 'سؤال اليوم الجديد متاح.',
    'notifications.universityTrending': '{{university}} رائجة الآن.',
    'notifications.newMessage': 'رسالة جديدة من {{name}}',
    'notifications.badgeEarned': 'حصلت على وسام جديد.',
  },
};

const render = (key: string, locale: string, params: Record<string, unknown>): string => {
  const table = COPY[locale] ?? COPY.en!;
  const template = table[key] ?? COPY.en![key] ?? key;
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(params[name] ?? ''));
};

/** Is it inside the recipient's configured quiet hours? */
const inQuietHours = (
  timezone: string,
  from: number | null,
  to: number | null,
): boolean => {
  if (from === null || to === null) return false;

  const local = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
  const minutes = local.getHours() * 60 + local.getMinutes();

  // A window like 22:00 -> 07:00 wraps past midnight.
  return from <= to ? minutes >= from && minutes < to : minutes >= from || minutes < to;
};

Deno.serve(async (request: Request) => {
  try {
    assertCronAuthorized(request);
  } catch (error) {
    return jsonResponse({ error: 'unauthorized' }, (error as { status?: number }).status ?? 401);
  }

  let record: NotificationRecord;
  try {
    const payload = (await request.json()) as { record?: NotificationRecord };
    if (!payload.record) return jsonResponse({ error: 'missing record' }, 400);
    record = payload.record;
  } catch {
    return jsonResponse({ error: 'invalid json' }, 400);
  }

  const supabase = serviceClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('locale, timezone')
    .eq('id', record.user_id)
    .maybeSingle();

  const { data: settings } = await supabase
    .from('notification_settings')
    .select('*')
    .eq('user_id', record.user_id)
    .maybeSingle();

  const settingKey = SETTING_FOR_KIND[record.kind];
  if (settings && settingKey && settings[settingKey] === false) {
    return jsonResponse({ skipped: 'muted by preference' });
  }

  if (
    settings &&
    inQuietHours(
      (profile?.timezone as string) ?? 'UTC',
      settings.quiet_from_minute as number | null,
      settings.quiet_to_minute as number | null,
    )
  ) {
    return jsonResponse({ skipped: 'quiet hours' });
  }

  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', record.user_id);

  if (!tokens || tokens.length === 0) {
    return jsonResponse({ skipped: 'no devices' });
  }

  const locale = (profile?.locale as string) ?? 'en';
  const body = render(record.title_key, locale, record.params ?? {});

  const messages: PushMessage[] = tokens.map((row) => ({
    to: row.token as string,
    title: 'Uni Streak',
    body,
    data: { link: record.link ?? '/', notificationId: record.id },
    sound: 'default',
    channelId: record.kind.startsWith('streak') ? 'streaks' : 'default',
  }));

  const deadTokens = await sendPushMessages(messages);
  if (deadTokens.length > 0) {
    await supabase.from('push_tokens').delete().in('token', deadTokens);
  }

  return jsonResponse({ sent: messages.length - deadTokens.length });
});
