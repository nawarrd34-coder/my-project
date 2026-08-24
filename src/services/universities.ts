import { supabase } from '@/lib/supabase';
import type { CampusPulse, Channel, University } from './types';

export const fetchUniversities = async (): Promise<University[]> => {
  const { data, error } = await supabase
    .from('universities')
    .select('*')
    .eq('is_active', true)
    .order('name_en');
  if (error) throw error;
  return data ?? [];
};

export const fetchChannels = async (universityId: string): Promise<Channel[]> => {
  const { data, error } = await supabase
    .from('channels')
    .select('*')
    .eq('university_id', universityId)
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
};

/** Everything the Home header and Campus Pulse need, in one round trip (§22). */
export const fetchCampusPulse = async (universityId?: string): Promise<CampusPulse> => {
  const { data, error } = await supabase.rpc('campus_pulse', {
    p_university: universityId ?? undefined,
  });
  if (error) throw error;
  return data as unknown as CampusPulse;
};

export interface BattleResult {
  a: { university_id: string; share: number };
  b: { university_id: string; share: number };
}

export const fetchBattle = async (a: string, b: string): Promise<BattleResult> => {
  const { data, error } = await supabase.rpc('university_battle', { p_a: a, p_b: b });
  if (error) throw error;
  return data as unknown as BattleResult;
};

export interface UniversityRanking {
  university_id: string;
  code: string;
  name_en: string;
  name_ar: string;
  streak_length: number;
  active_today: number;
  member_count: number;
}

export const fetchUniversityLeaderboard = async (limit = 20): Promise<UniversityRanking[]> => {
  const { data, error } = await supabase.rpc('university_leaderboard', { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as unknown as UniversityRanking[];
};

export interface StudentRanking {
  user_id: string;
  username: string;
  avatar_url: string | null;
  longest_streak: number;
  post_count: number;
  message_count: number;
}

export const fetchStudentLeaderboard = async (limit = 20): Promise<StudentRanking[]> => {
  const { data, error } = await supabase.rpc('student_leaderboard', { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as unknown as StudentRanking[];
};

/** Answer the question of the day (§21). */
export const answerDailyQuestion = async (questionId: string, optionId: string): Promise<void> => {
  const { error } = await supabase
    .from('daily_question_answers')
    .insert({ question_id: questionId, option_id: optionId, user_id: (await requireUserId()) });
  if (error) throw error;
};

const requireUserId = async (): Promise<string> => {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('not authenticated');
  return data.user.id;
};
