import { supabase } from '@/lib/supabase';
import type {
  FeedPost,
  IdentityMode,
  Page,
  PostKind,
  ReactionEmoji,
  ThreadComment,
} from './types';

export const FEED_PAGE_SIZE = 20;

/**
 * Keyset pagination on `created_at`. Offset pagination would re-scan and, on a
 * live feed, silently skip or duplicate rows as new posts arrive (§35).
 */
export const fetchFeed = async (params: {
  universityId: string;
  channelId?: string | null;
  cursor?: string | null;
  limit?: number;
}): Promise<Page<FeedPost>> => {
  const limit = params.limit ?? FEED_PAGE_SIZE;

  let query = supabase
    .from('feed_posts')
    .select('*')
    .eq('university_id', params.universityId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (params.channelId) query = query.eq('channel_id', params.channelId);
  if (params.cursor) query = query.lt('created_at', params.cursor);

  const { data, error } = await query;
  if (error) throw error;

  const items = data ?? [];
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: items.length === limit && last?.created_at ? last.created_at : null,
  };
};

export const fetchPost = async (postId: string): Promise<FeedPost | null> => {
  const { data, error } = await supabase
    .from('feed_posts')
    .select('*')
    .eq('id', postId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export interface CreatePostInput {
  body: string;
  kind?: PostKind;
  channelId?: string | null;
  identityMode?: IdentityMode | null;
  media?: { kind: 'image' | 'video' | 'audio'; storage_path: string; width?: number; height?: number; duration_ms?: number; blurhash?: string }[];
  pollOptions?: string[];
  soundId?: string | null;
}

export const createPost = async (input: CreatePostInput): Promise<{ id: string }> => {
  const { data, error } = await supabase.rpc('create_post', {
    p_body: input.body,
    p_kind: input.kind ?? 'text',
    p_channel_id: input.channelId ?? undefined,
    p_identity_mode: input.identityMode ?? undefined,
    p_media: (input.media ?? []) as never,
    p_poll_options: input.pollOptions ?? undefined,
    p_sound_id: input.soundId ?? undefined,
  });
  if (error) throw error;
  return data as unknown as { id: string };
};

export const deletePost = async (postId: string): Promise<void> => {
  const { error } = await supabase
    .from('posts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', postId);
  if (error) throw error;
};

/**
 * Add, swap or remove a reaction in one call. Returns the emoji now held, or
 * null if the reaction was removed - which is exactly what the optimistic
 * update needs to reconcile against.
 */
export const togglePostReaction = async (
  postId: string,
  emoji: ReactionEmoji,
): Promise<string | null> => {
  const { data, error } = await supabase.rpc('toggle_post_reaction', {
    p_post: postId,
    p_emoji: emoji,
  });
  if (error) throw error;
  return (data as string | null) ?? null;
};

export const toggleCommentReaction = async (
  commentId: string,
  emoji: ReactionEmoji,
): Promise<string | null> => {
  const { data, error } = await supabase.rpc('toggle_comment_reaction', {
    p_comment: commentId,
    p_emoji: emoji,
  });
  if (error) throw error;
  return (data as string | null) ?? null;
};

/** Reaction totals per emoji for a set of posts, plus the viewer's own pick. */
export interface ReactionSummary {
  counts: Record<string, number>;
  mine: string | null;
}

export const fetchReactionSummaries = async (
  postIds: string[],
): Promise<Record<string, ReactionSummary>> => {
  if (postIds.length === 0) return {};

  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('reactions')
    .select('post_id, emoji, user_id')
    .in('post_id', postIds);
  if (error) throw error;

  const summaries: Record<string, ReactionSummary> = {};
  for (const id of postIds) summaries[id] = { counts: {}, mine: null };

  for (const row of data ?? []) {
    if (!row.post_id) continue;
    const summary = summaries[row.post_id];
    if (!summary) continue;
    summary.counts[row.emoji] = (summary.counts[row.emoji] ?? 0) + 1;
    if (row.user_id === auth.user?.id) summary.mine = row.emoji;
  }
  return summaries;
};

export const fetchComments = async (postId: string): Promise<ThreadComment[]> => {
  const { data, error } = await supabase
    .from('thread_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
};

export const createComment = async (params: {
  postId: string;
  body: string;
  parentId?: string | null;
  identityMode?: IdentityMode;
}): Promise<void> => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('not authenticated');

  const { error } = await supabase.from('comments').insert({
    post_id: params.postId,
    author_id: auth.user.id,
    body: params.body,
    parent_id: params.parentId ?? null,
    identity_mode: params.identityMode ?? 'public',
  });
  if (error) throw error;
};

export const savePost = async (postId: string, saved: boolean): Promise<void> => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('not authenticated');

  if (saved) {
    const { error } = await supabase
      .from('saved_posts')
      .insert({ post_id: postId, user_id: auth.user.id });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('saved_posts')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', auth.user.id);
    if (error) throw error;
  }
};

export const voteOnPoll = async (postId: string, optionId: string): Promise<void> => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('not authenticated');

  const { error } = await supabase
    .from('poll_votes')
    .insert({ post_id: postId, option_id: optionId, user_id: auth.user.id });
  if (error) throw error;
};

export interface PollOption {
  id: string;
  label: string;
  position: number;
  vote_count: number;
}

export const fetchPollOptions = async (postId: string): Promise<PollOption[]> => {
  const { data, error } = await supabase
    .from('poll_options')
    .select('id, label, position, vote_count')
    .eq('post_id', postId)
    .order('position');
  if (error) throw error;
  return data ?? [];
};
