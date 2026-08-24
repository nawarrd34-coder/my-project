import { supabase } from '@/lib/supabase';
import type { ReportReason, ReportRow, ReportTarget } from './types';

export interface SubmitReportInput {
  target: ReportTarget;
  reason: ReportReason;
  postId?: string;
  commentId?: string;
  messageId?: string;
  userId?: string;
  conversationId?: string;
  details?: string;
}

export const submitReport = async (input: SubmitReportInput): Promise<ReportRow> => {
  const { data, error } = await supabase.rpc('submit_report', {
    p_target: input.target,
    p_reason: input.reason,
    p_post: input.postId ?? undefined,
    p_comment: input.commentId ?? undefined,
    p_message: input.messageId ?? undefined,
    p_user: input.userId ?? undefined,
    p_conversation: input.conversationId ?? undefined,
    p_details: input.details ?? undefined,
  });
  if (error) throw error;
  return data as unknown as ReportRow;
};

// --- Moderator surface. Each of these fails server-side unless the caller
// --- actually holds the role, so a hidden UI is defence in depth, not the
// --- security boundary (§32).

export const fetchReports = async (status: 'open' | 'reviewing' | 'actioned' | 'dismissed' = 'open') => {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
};

export const removePost = async (postId: string, note?: string): Promise<void> => {
  const { error } = await supabase.rpc('moderate_remove_post', {
    p_post: postId,
    p_note: note ?? undefined,
  });
  if (error) throw error;
};

export const banUser = async (params: {
  userId: string;
  reason: string;
  /** Postgres interval string, e.g. '7 days'. Omit for a permanent ban. */
  duration?: string | null;
  scope?: 'platform' | 'university';
}): Promise<void> => {
  const { error } = await supabase.rpc('moderate_ban_user', {
    p_user: params.userId,
    p_reason: params.reason,
    p_duration: params.duration ?? undefined,
    p_scope: params.scope ?? 'platform',
  });
  if (error) throw error;
};

export const unbanUser = async (userId: string, note?: string): Promise<void> => {
  const { error } = await supabase.rpc('moderate_unban_user', {
    p_user: userId,
    p_note: note ?? undefined,
  });
  if (error) throw error;
};

export const resolveReport = async (
  reportId: string,
  status: 'actioned' | 'dismissed',
  note?: string,
): Promise<void> => {
  const { error } = await supabase.rpc('moderate_resolve_report', {
    p_report: reportId,
    p_status: status,
    p_note: note ?? undefined,
  });
  if (error) throw error;
};

/** My active ban, if any, so the UI can explain the restriction (§29). */
export const fetchMyBan = async () => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data, error } = await supabase
    .from('bans')
    .select('*')
    .eq('user_id', auth.user.id)
    .is('lifted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  return data;
};
