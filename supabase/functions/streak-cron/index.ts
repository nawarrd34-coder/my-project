/**
 * Scheduled streak maintenance.
 *
 * Runs hourly (see supabase/README.md for the pg_cron schedule). Each run:
 *
 *   1. expires every streak whose deadline has passed, archiving the run into
 *      streak_history rather than deleting it (§18)
 *   2. rolls each university's daily activity forward against its configurable
 *      threshold (§19)
 *   3. queues reminder notifications for streaks about to lapse, but only for
 *      the participant who has not yet shown up today (§28)
 *
 * Hourly rather than daily because users span timezones: "end of day" happens
 * at a different instant for each streak (§34).
 */
import { assertCronAuthorized, jsonResponse, serviceClient } from '../_shared/supabase.ts';
import { sendPushMessages, type PushMessage } from '../_shared/expo-push.ts';

const REMINDER_WINDOW = '4 hours';

Deno.serve(async (request: Request) => {
  try {
    assertCronAuthorized(request);
  } catch (error) {
    return jsonResponse({ error: 'unauthorized' }, (error as { status?: number }).status ?? 401);
  }

  const supabase = serviceClient();
  const summary = { expired: 0, universities: 0, remindersQueued: 0, pushSent: 0 };

  // --- 1. Expire lapsed streaks -------------------------------------------
  const { data: expired, error: expireError } = await supabase.rpc('expire_due_streaks_admin');
  if (expireError) {
    console.error('expire_due_streaks failed', expireError);
  } else {
    summary.expired = (expired as number | null) ?? 0;
  }

  // --- 2. Roll university streaks -----------------------------------------
  const { data: universities } = await supabase
    .from('universities')
    .select('id, timezone')
    .eq('is_active', true);

  for (const university of universities ?? []) {
    // Close out *yesterday* in that campus's own zone: today is still in
    // progress and must not be judged against the threshold yet.
    const localToday = new Date(
      new Date().toLocaleString('en-US', { timeZone: university.timezone }),
    );
    localToday.setDate(localToday.getDate() - 1);
    const yesterday = localToday.toISOString().slice(0, 10);

    const { error } = await supabase.rpc('roll_university_streak_admin', {
      p_university: university.id,
      p_day: yesterday,
    });
    if (error) console.error('roll_university_streak failed', university.id, error);
    else summary.universities += 1;
  }

  // --- 3. Streak reminders -------------------------------------------------
  const { data: expiring, error: expiringError } = await supabase.rpc('streaks_expiring_admin', {
    p_within: REMINDER_WINDOW,
  });

  if (expiringError) {
    console.error('streaks_expiring failed', expiringError);
    return jsonResponse(summary);
  }

  type ExpiringRow = {
    streak_id: string;
    user_id: string;
    partner_id: string;
    current_length: number;
    expires_at: string;
  };

  const rows = (expiring ?? []) as ExpiringRow[];
  if (rows.length === 0) return jsonResponse(summary);

  // Respect each user's notification preferences (§28).
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: settings } = await supabase
    .from('notification_settings')
    .select('user_id, streaks')
    .in('user_id', userIds);

  const streaksEnabled = new Map(
    (settings ?? []).map((s) => [s.user_id as string, s.streaks as boolean]),
  );

  const { data: partners } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .in('id', [...new Set(rows.map((r) => r.partner_id))]);

  const partnerName = new Map(
    (partners ?? []).map((p) => [
      p.id as string,
      (p.display_name as string | null) ?? (p.username as string),
    ]),
  );

  const eligible = rows.filter((row) => streaksEnabled.get(row.user_id) !== false);

  // Insert in-app notifications. Text is stored as an i18n key plus params so
  // it renders in each reader's own language (§4).
  if (eligible.length > 0) {
    const { error: insertError } = await supabase.from('notifications').insert(
      eligible.map((row) => ({
        user_id: row.user_id,
        kind: 'streak_expiring' as const,
        title_key: 'notifications.streakExpiring',
        params: { count: row.current_length, name: partnerName.get(row.partner_id) ?? '' },
        link: `/chat`,
        actor_id: row.partner_id,
      })),
    );
    if (insertError) console.error('notification insert failed', insertError);
    else summary.remindersQueued = eligible.length;
  }

  // --- 4. Push --------------------------------------------------------------
  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('user_id, token, platform')
    .in('user_id', eligible.map((r) => r.user_id));

  const tokensByUser = new Map<string, { token: string; platform: string }[]>();
  for (const row of tokens ?? []) {
    const list = tokensByUser.get(row.user_id as string) ?? [];
    list.push({ token: row.token as string, platform: row.platform as string });
    tokensByUser.set(row.user_id as string, list);
  }

  const messages: PushMessage[] = [];
  for (const row of eligible) {
    for (const device of tokensByUser.get(row.user_id) ?? []) {
      messages.push({
        to: device.token,
        title: '🔥 Uni Streak',
        body: `Your ${row.current_length} day streak with ${partnerName.get(row.partner_id) ?? ''} expires soon.`,
        data: { link: '/streaks', streakId: row.streak_id },
        sound: 'default',
        channelId: 'streaks',
      });
    }
  }

  if (messages.length > 0) {
    const deadTokens = await sendPushMessages(messages);
    summary.pushSent = messages.length - deadTokens.length;

    if (deadTokens.length > 0) {
      await supabase.from('push_tokens').delete().in('token', deadTokens);
    }
  }

  return jsonResponse(summary);
});
