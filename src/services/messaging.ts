import { supabase } from '@/lib/supabase';
import type { Conversation, Message, MessageKind, Page, Profile } from './types';

export const MESSAGE_PAGE_SIZE = 30;

export interface ConversationSummary {
  conversation: Conversation;
  /** The other person, for a direct chat. Null for a group. */
  partner: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'last_active_at' | 'show_online_status'> | null;
  unreadCount: number;
  lastReadAt: string;
  muted: boolean;
}

export const fetchConversations = async (): Promise<ConversationSummary[]> => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const me = auth.user.id;

  const { data: memberships, error } = await supabase
    .from('conversation_members')
    .select('conversation_id, last_read_at, muted_until, conversations(*)')
    .eq('user_id', me)
    .is('left_at', null);
  if (error) throw error;

  const rows = (memberships ?? []) as unknown as {
    conversation_id: string;
    last_read_at: string;
    muted_until: string | null;
    conversations: Conversation | null;
  }[];

  const conversationIds = rows.map((r) => r.conversation_id);
  if (conversationIds.length === 0) return [];

  // Resolve the other participant for every direct chat in one query rather
  // than one query per row.
  const { data: others, error: othersError } = await supabase
    .from('conversation_members')
    .select('conversation_id, profiles(id, username, display_name, avatar_url, last_active_at, show_online_status)')
    .in('conversation_id', conversationIds)
    .neq('user_id', me)
    .is('left_at', null);
  if (othersError) throw othersError;

  const partnerByConversation = new Map<string, ConversationSummary['partner']>();
  for (const row of (others ?? []) as unknown as {
    conversation_id: string;
    profiles: ConversationSummary['partner'];
  }[]) {
    if (!partnerByConversation.has(row.conversation_id)) {
      partnerByConversation.set(row.conversation_id, row.profiles);
    }
  }

  // Unread counts: messages newer than the member's read watermark.
  const { data: unread, error: unreadError } = await supabase
    .from('messages')
    .select('conversation_id, created_at')
    .in('conversation_id', conversationIds)
    .neq('sender_id', me)
    .is('deleted_at', null);
  if (unreadError) throw unreadError;

  const summaries: ConversationSummary[] = [];
  for (const row of rows) {
    if (!row.conversations) continue;
    const readAt = new Date(row.last_read_at).getTime();
    const unreadCount = (unread ?? []).filter(
      (m) => m.conversation_id === row.conversation_id && new Date(m.created_at).getTime() > readAt,
    ).length;

    summaries.push({
      conversation: row.conversations,
      partner: partnerByConversation.get(row.conversation_id) ?? null,
      unreadCount,
      lastReadAt: row.last_read_at,
      muted: !!row.muted_until && new Date(row.muted_until) > new Date(),
    });
  }

  return summaries.sort((a, b) => {
    const at = a.conversation.last_message_at ?? a.conversation.created_at;
    const bt = b.conversation.last_message_at ?? b.conversation.created_at;
    return new Date(bt).getTime() - new Date(at).getTime();
  });
};

export const openDirectConversation = async (otherUserId: string): Promise<Conversation> => {
  const { data, error } = await supabase.rpc('open_direct_conversation', { p_other: otherUserId });
  if (error) throw error;
  return data as unknown as Conversation;
};

export const fetchMessages = async (params: {
  conversationId: string;
  cursor?: string | null;
  limit?: number;
}): Promise<Page<Message>> => {
  const limit = params.limit ?? MESSAGE_PAGE_SIZE;

  let query = supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', params.conversationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (params.cursor) query = query.lt('created_at', params.cursor);

  const { data, error } = await query;
  if (error) throw error;

  const items = data ?? [];
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: items.length === limit && last ? last.created_at : null,
  };
};

export interface SendMessageInput {
  conversationId: string;
  body?: string;
  kind?: MessageKind;
  storagePath?: string | null;
  durationMs?: number | null;
  replyToId?: string | null;
  soundId?: string | null;
  /**
   * Client-generated idempotency key. A retried send returns the original
   * message rather than creating a duplicate - and, critically, does not
   * record a second streak contribution.
   */
  clientNonce?: string;
}

export const sendMessage = async (input: SendMessageInput): Promise<Message> => {
  const { data, error } = await supabase.rpc('send_message', {
    p_conversation: input.conversationId,
    p_body: input.body ?? undefined,
    p_kind: input.kind ?? 'text',
    p_storage_path: input.storagePath ?? undefined,
    p_duration_ms: input.durationMs ?? undefined,
    p_reply_to: input.replyToId ?? undefined,
    p_sound_id: input.soundId ?? undefined,
    p_client_nonce: input.clientNonce ?? undefined,
  });
  if (error) throw error;
  return data as unknown as Message;
};

export const markConversationRead = async (conversationId: string): Promise<void> => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;

  const { error } = await supabase
    .from('conversation_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', auth.user.id);
  if (error) throw error;
};

/** Publish a short-lived typing marker (§12). Safe to call on every keystroke. */
export const setTyping = async (conversationId: string): Promise<void> => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;

  await supabase.from('typing_indicators').upsert(
    {
      conversation_id: conversationId,
      user_id: auth.user.id,
      expires_at: new Date(Date.now() + 8000).toISOString(),
    },
    { onConflict: 'conversation_id,user_id' },
  );
};

export const clearTyping = async (conversationId: string): Promise<void> => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  await supabase
    .from('typing_indicators')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('user_id', auth.user.id);
};

export const toggleMessageReaction = async (messageId: string, emoji: string): Promise<void> => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('not authenticated');

  const { data: existing } = await supabase
    .from('message_reactions')
    .select('emoji')
    .eq('message_id', messageId)
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (existing?.emoji === emoji) {
    await supabase
      .from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', auth.user.id);
    return;
  }

  const { error } = await supabase
    .from('message_reactions')
    .upsert(
      { message_id: messageId, user_id: auth.user.id, emoji },
      { onConflict: 'message_id,user_id' },
    );
  if (error) throw error;
};

export const deleteMessage = async (messageId: string): Promise<void> => {
  const { error } = await supabase
    .from('messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', messageId);
  if (error) throw error;
};

// ---------------------------------------------------------------------------
// Groups (§13)
// ---------------------------------------------------------------------------

export const createGroup = async (params: {
  title: string;
  universityId: string;
  memberIds: string[];
  isPublic?: boolean;
  description?: string | null;
}): Promise<Conversation> => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('not authenticated');

  const { data: conversation, error } = await supabase
    .from('conversations')
    .insert({
      kind: 'group',
      title: params.title,
      university_id: params.universityId,
      created_by: auth.user.id,
      is_public: params.isPublic ?? true,
      description: params.description ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  // The creator joins as admin first, which is what authorises adding others.
  const { error: selfError } = await supabase
    .from('conversation_members')
    .insert({ conversation_id: conversation.id, user_id: auth.user.id, is_admin: true });
  if (selfError) throw selfError;

  if (params.memberIds.length > 0) {
    const { error: membersError } = await supabase.from('conversation_members').insert(
      params.memberIds.map((id) => ({ conversation_id: conversation.id, user_id: id })),
    );
    if (membersError) throw membersError;
  }

  return conversation;
};

export const fetchGroupMembers = async (conversationId: string) => {
  const { data, error } = await supabase
    .from('conversation_members')
    .select('user_id, is_admin, joined_at, profiles(id, username, display_name, avatar_url)')
    .eq('conversation_id', conversationId)
    .is('left_at', null);
  if (error) throw error;
  return data ?? [];
};

export const leaveGroup = async (conversationId: string): Promise<void> => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('not authenticated');

  const { error } = await supabase
    .from('conversation_members')
    .update({ left_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', auth.user.id);
  if (error) throw error;
};

export const setConversationMuted = async (
  conversationId: string,
  muted: boolean,
): Promise<void> => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('not authenticated');

  const { error } = await supabase
    .from('conversation_members')
    .update({
      // A long mute rather than a nullable "forever" flag keeps the schema
      // simple and lets the user rediscover the setting later.
      muted_until: muted ? new Date(Date.now() + 365 * 24 * 3600_000).toISOString() : null,
    })
    .eq('conversation_id', conversationId)
    .eq('user_id', auth.user.id);
  if (error) throw error;
};

export const searchPublicGroups = async (universityId: string, term: string) => {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('kind', 'group')
    .eq('is_public', true)
    .eq('university_id', universityId)
    .ilike('title', `%${term}%`)
    .order('member_count', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data ?? [];
};

export const joinGroup = async (conversationId: string): Promise<void> => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('not authenticated');

  const { error } = await supabase
    .from('conversation_members')
    .upsert(
      { conversation_id: conversationId, user_id: auth.user.id, left_at: null },
      { onConflict: 'conversation_id,user_id' },
    );
  if (error) throw error;
};
