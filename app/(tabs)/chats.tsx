import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { ListSkeleton } from '@/components/feedback/Skeleton';
import { useRealtimeChannel } from '@/hooks/useRealtimeChannel';
import { formatRelative } from '@/lib/datetime';
import { errorTranslationKey } from '@/lib/errors';
import { queryKeys } from '@/lib/queryClient';
import { fetchConversations, type ConversationSummary } from '@/services/messaging';
import { useTheme } from '@/theme/ThemeProvider';

type Filter = 'all' | 'direct' | 'groups';

export default function ChatsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState<Filter>('all');

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.conversations,
    queryFn: fetchConversations,
    staleTime: 15_000,
  });

  // A new message anywhere reorders this list, so refresh on any insert the
  // reader is entitled to see.
  useRealtimeChannel(
    { channel: 'conversations-list', table: 'messages', event: 'INSERT' },
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
    }, [queryClient]),
  );

  const conversations = (data ?? []).filter((item) =>
    filter === 'all'
      ? true
      : filter === 'direct'
        ? item.conversation.kind === 'direct'
        : item.conversation.kind === 'group',
  );

  const renderItem = useCallback(
    ({ item }: { item: ConversationSummary }) => {
      const isGroup = item.conversation.kind === 'group';
      const title = isGroup
        ? (item.conversation.title ?? '')
        : (item.partner?.display_name ?? `@${item.partner?.username ?? ''}`);

      const isOnline =
        !!item.partner?.show_online_status &&
        Date.now() - new Date(item.partner.last_active_at).getTime() < 5 * 60_000;

      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={title}
          onPress={() => router.push(`/chat/${item.conversation.id}`)}
          style={({ pressed }) => [
            styles.row,
            {
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.md,
              gap: theme.spacing.md,
              backgroundColor: pressed ? theme.colors.surfacePressed : 'transparent',
            },
          ]}
        >
          <Avatar
            uri={isGroup ? item.conversation.avatar_url : item.partner?.avatar_url}
            name={isGroup ? title : item.partner?.username}
            size={52}
            showOnlineDot={!isGroup}
            isOnline={isOnline}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <View style={styles.titleRow}>
              <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
                {title}
              </Text>
              {item.conversation.last_message_at ? (
                <Text variant="micro" color="muted">
                  {formatRelative(item.conversation.last_message_at, i18n.language, t)}
                </Text>
              ) : null}
            </View>
            <View style={styles.titleRow}>
              <Text
                variant="caption"
                color={item.unreadCount > 0 ? 'primary' : 'secondary'}
                numberOfLines={1}
                style={{ flex: 1 }}
              >
                {item.conversation.last_message_preview ?? ''}
              </Text>
              {item.muted ? <Text variant="micro" color="muted">🔕</Text> : null}
              {item.unreadCount > 0 ? (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: theme.colors.accent, borderRadius: theme.radius.pill },
                  ]}
                >
                  <Text variant="micro" style={{ color: theme.colors.textOnAccent }}>
                    {item.unreadCount > 99 ? '99+' : item.unreadCount}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </Pressable>
      );
    },
    [router, theme, i18n.language, t],
  );

  const filterChip = (value: Filter, label: string) => (
    <Pressable
      key={value}
      accessibilityRole="tab"
      accessibilityState={{ selected: filter === value }}
      accessibilityLabel={label}
      onPress={() => setFilter(value)}
      style={[
        styles.chip,
        {
          borderRadius: theme.radius.pill,
          backgroundColor: filter === value ? theme.colors.accent : theme.colors.surfaceSunken,
        },
      ]}
    >
      <Text
        variant="captionStrong"
        style={{ color: filter === value ? theme.colors.textOnAccent : theme.colors.textSecondary }}
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { padding: theme.spacing.lg }]}>
        <Text variant="h1" style={{ flex: 1 }}>
          {t('chats.title')}
        </Text>
        <IconButton
          icon="people-outline"
          accessibilityLabel={t('chats.newGroup')}
          onPress={() => router.push('/chat/new-group')}
        />
        <IconButton
          icon="create-outline"
          accessibilityLabel={t('chats.newChat')}
          onPress={() => router.push('/chat/new')}
        />
      </View>

      <View style={[styles.filters, { paddingHorizontal: theme.spacing.lg }]}>
        {filterChip('all', t('common.seeAll'))}
        {filterChip('direct', t('chats.direct'))}
        {filterChip('groups', t('chats.groups'))}
      </View>

      {isLoading ? (
        <ListSkeleton count={4} />
      ) : error ? (
        <ErrorState message={t(errorTranslationKey(error))} onRetry={() => void refetch()} />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.conversation.id}
          renderItem={renderItem}
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          ItemSeparatorComponent={() => (
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.divider }} />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="chatbubbles-outline"
              title={t('empty.chatsTitle')}
              body={t('empty.chatsBody')}
              actionLabel={t('chats.newChat')}
              onAction={() => router.push('/chat/new')}
            />
          }
          contentContainerStyle={{ paddingBottom: theme.spacing.giant }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  filters: { flexDirection: 'row', gap: 8, paddingBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 7 },
  row: { flexDirection: 'row', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
});
