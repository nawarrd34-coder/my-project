import { supabase } from '@/lib/supabase';
import type { StreakRow, StreakWithPartner } from './types';

/**
 * Every direct streak the signed-in user is part of, joined with the other
 * participant and with "have I shown up today" resolved.
 *
 * The streak values themselves are read verbatim from the server; nothing here
 * recomputes a length or a deadline (§33).
 */
export const fetchMyStreaks = async (): Promise<StreakWithPartner[]> => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const me = auth.user.id;

  const { data, error } = await supabase
    .from('streaks')
    .select(
      `id, status, current_length, longest_length, expires_at, expired_at,
       last_qualified_on, conversation_id, user_low, user_high, timezone,
       low:profiles!streaks_user_low_fkey(id, username, display_name, avatar_url),
       high:profiles!streaks_user_high_fkey(id, username, display_name, avatar_url)`,
    )
    .eq('scope', 'direct')
    .order('current_length', { ascending: false });
  if (error) throw error;

  type Row = StreakRow & {
    low: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null;
    high: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null;
  };

  const rows = (data ?? []) as unknown as Row[];
  const streakIds = rows.map((r) => r.id);

  // Which of these streaks I have already contributed to today. One query for
  // all of them rather than one per row.
  const todayByStreak = new Map<string, boolean>();
  if (streakIds.length > 0) {
    const { data: events, error: eventsError } = await supabase
      .from('streak_events')
      .select('streak_id, local_day')
      .in('streak_id', streakIds)
      .eq('user_id', me);
    if (eventsError) throw eventsError;

    for (const row of rows) {
      const localToday = new Intl.DateTimeFormat('en-CA', {
        timeZone: row.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      const done = (events ?? []).some(
        (e) => e.streak_id === row.id && e.local_day === localToday,
      );
      todayByStreak.set(row.id, done);
    }
  }

  return rows.flatMap((row) => {
    const partnerRow = row.user_low === me ? row.high : row.low;
    if (!partnerRow) return [];
    return [
      {
        id: row.id,
        status: row.status,
        currentLength: row.current_length,
        longestLength: row.longest_length,
        expiresAt: row.expires_at,
        expiredAt: row.expired_at,
        lastQualifiedOn: row.last_qualified_on,
        conversationId: row.conversation_id,
        myTurnDone: todayByStreak.get(row.id) ?? false,
        partner: {
          id: partnerRow.id,
          username: partnerRow.username,
          displayName: partnerRow.display_name,
          avatarUrl: partnerRow.avatar_url,
        },
      },
    ];
  });
};

/** Restore a lapsed streak within the grace window (§18). */
export const restoreStreak = async (streakId: string): Promise<void> => {
  const { error } = await supabase.rpc('restore_streak', { p_streak: streakId });
  if (error) throw error;
};

export interface StreakHistoryEntry {
  id: string;
  length: number;
  started_on: string | null;
  ended_on: string;
  ended_reason: string;
}

export const fetchStreakHistory = async (streakId: string): Promise<StreakHistoryEntry[]> => {
  const { data, error } = await supabase
    .from('streak_history')
    .select('id, length, started_on, ended_on, ended_reason')
    .eq('streak_id', streakId)
    .order('ended_on', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

/** The university's own activity streak (§19). */
export const fetchUniversityStreak = async (universityId: string) => {
  const { data, error } = await supabase
    .from('streaks')
    .select('current_length, longest_length, status, last_qualified_on')
    .eq('scope', 'university')
    .eq('university_id', universityId)
    .maybeSingle();
  if (error) throw error;
  return data;
};
