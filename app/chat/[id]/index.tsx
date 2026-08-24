import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/IconButton';
import { StreakBadge } from '@/components/ui/StreakBadge';
import { Text } from '@/components/ui/Text';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { ListSkeleton } from '@/components/feedback/Skeleton';
import { ChatInput } from '@/features/chat/ChatInput';
import { MessageBubble } from '@/features/chat/MessageBubble';
import { useChatMessages, type OptimisticMessage } from '@/features/chat/useChatMessages';
import { useRealtimeChannel } from '@/hooks/useRealtimeChannel';
import { formatDaySeparator, formatRelative } from '@/lib/datetime';
import { errorTranslationKey } from '@/lib/errors';
import { queryKeys } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { backChevron } from '@/lib/rtl';
import { clearTyping, markConversationRead, setTyping } from '@/services/messaging';
import { fetchMyStreaks } from '@/services/streaks';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme/ThemeProvider';

export default function ChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();

  const { id } = useLocalSearchParams<{ id: string }>();
  const conversationId = id ?? null;
  const profile = useSession((s) => s.profile);
  const myId = profile?.id ?? null;

  const [partnerTyping, setPartnerTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const conversationQuery = useQuery({
    queryKey: queryKeys.conversation(conversationId ?? ''),
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('*, conversation_members(user_id, last_read_at, profiles(id, username, display_name, avatar_url, last_active_at, show_online_status))')
        .eq('id', conversationId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const streaksQuery = useQuery({
    queryKey: queryKeys.streaks,
    queryFn: fetchMyStreaks,
    staleTime: 30_000,
  });

  const {
    messages,
    isLoading,
    error,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    send,
    retry,
  } = useChatMessages(conversationId, myId);

  const members = useMemo(() => {
    const raw = conversationQuery.data as
      | { conversation_members?: { user_id: string; last_read_at: string; profiles: { id: string; username: string; display_name: string | null; avatar_url: string | null; last_active_at: string; show_online_status: boolean } | null }[] }
      | undefined;
    return raw?.conversation_members ?? [];
  }, [conversationQuery.data]);

  const partner = useMemo(
    () => members.find((m) => m.user_id !== myId)?.profiles ?? null,
    [members, myId],
  );

  /** The other side's read watermark, for the double-tick on my messages. */
  const partnerReadAt = useMemo(() => {
    const row = members.find((m) => m.user_id !== myId);
    return row ? new Date(row.last_read_at).getTime() : 0;
  }, [members, myId]);

  const streak = useMemo(
    () => (streaksQuery.data ?? []).find((s) => s.conversationId === conversationId) ?? null,
    [streaksQuery.data, conversationId],
  );

  // Opening the chat clears the unread badge.
  useEffect(() => {
    if (!conversationId) return;
    void markConversationRead(conversationId).then(() =>
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations }),
    );
  }, [conversationId, queryClient]);

  useRealtimeChannel<{ user_id: string; expires_at: string }>(
    {
      channel: `typing:${conversationId ?? 'none'}`,
      table: 'typing_indicators',
      event: '*',
      filter: conversationId ? `conversation_id=eq.${conversationId}` : undefined,
      enabled: !!conversationId,
    },
    useCallback(
      (payload) => {
        const row = payload.new as Partial<{ user_id: string; expires_at: string }> | undefined;
        if (!row?.user_id || row.user_id === myId) return;
        // Trust the row's own expiry rather than a fixed local timer.
        const remaining = row.expires_at ? new Date(row.expires_at).getTime() - Date.now() : 0;
        if (remaining <= 0) return;

        setPartnerTyping(true);
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setPartnerTyping(false), remaining);
      },
      [myId],
    ),
  );

  useEffect(
    () => () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (conversationId) void clearTyping(conversationId);
    },
    [conversationId],
  );

  const isGroup = conversationQuery.data?.kind === 'group';
  const title = isGroup
    ? (conversationQuery.data?.title ?? '')
    : (partner?.display_name ?? `@${partner?.username ?? ''}`);

  const subtitle = isGroup
    ? t('chats.members', { count: conversationQuery.data?.member_count ?? 0 })
    : partnerTyping
      ? t('chats.typing')
      : partner?.show_online_status
        ? Date.now() - new Date(partner.last_active_at).getTime() < 5 * 60_000
          ? t('chats.online')
          : t('chats.lastSeen', { time: formatRelative(partner.last_active_at, i18n.language, t) })
        : '';

  const renderItem = useCallback(
    ({ item, index }: { item: OptimisticMessage; index: number }) => {
      // The list is inverted, so the "next" entry is the older message.
      const older = messages[index + 1];
      const showDay =
        !older ||
        new Date(older.created_at).toDateString() !== new Date(item.created_at).toDateString();

      return (
        <>
          <MessageBubble
            message={item}
            isMine={item.sender_id === myId}
            isRead={new Date(item.created_at).getTime() <= partnerReadAt}
            pending={item.__pending}
            failed={item.__failed}
            onRetry={() => item.client_nonce && void retry(item.client_nonce)}
          />
          {showDay ? (
            <Text variant="micro" color="muted" align="center" style={{ paddingVertical: 8 }}>
              {formatDaySeparator(item.created_at, i18n.language, t)}
            </Text>
          ) : null}
        </>
      );
    },
    [messages, myId, partnerReadAt, retry, i18n.language, t],
  );

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 4,
            paddingHorizontal: theme.spacing.sm,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.colors.divider,
          },
        ]}
      >
        <IconButton icon={backChevron()} accessibilityLabel={t('a11y.back')} onPress={() => router.back()} />
        <Avatar
          uri={partner?.avatar_url}
          name={isGroup ? title : partner?.username}
          size={36}
          showOnlineDot={!isGroup && !!partner?.show_online_status}
          isOnline={
            !!partner && Date.now() - new Date(partner.last_active_at).getTime() < 5 * 60_000
          }
        />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="micro" color={partnerTyping ? 'accent' : 'muted'} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {streak ? (
          <StreakBadge count={streak.currentLength} status={streak.status} size="sm" />
        ) : null}
        <IconButton
          icon="ellipsis-vertical"
          accessibilityLabel={t('common.more')}
          onPress={() => router.push(`/chat/${conversationId}/info`)}
        />
      </View>

      {isLoading ? (
        <ListSkeleton count={3} />
      ) : error ? (
        <ErrorState message={t(errorTranslationKey(error))} onRetry={() => void refetch()} />
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          // Inverted so new messages appear at the bottom and pagination
          // loads history upward, which is what "onEndReached" means here.
          inverted
          ListEmptyComponent={
            <View style={{ transform: [{ scaleY: -1 }] }}>
              <EmptyState
                icon="chatbubble-ellipses-outline"
                title={t('empty.messagesTitle')}
                body={t('empty.messagesBody')}
              />
            </View>
          }
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
          }}
          contentContainerStyle={{ paddingVertical: theme.spacing.md }}
          removeClippedSubviews
          maxToRenderPerBatch={12}
          windowSize={11}
        />
      )}

      <ChatInput
        onSendText={(body) => void send({ body })}
        onSendImage={(storagePath) => void send({ kind: 'image', storagePath })}
        onSendVoice={(storagePath, durationMs) =>
          void send({ kind: 'voice', storagePath, durationMs })
        }
        onTyping={() => conversationId && void setTyping(conversationId)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 8 },
});
