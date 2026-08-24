import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ListSkeleton } from '@/components/feedback/Skeleton';
import { formatRelative } from '@/lib/datetime';
import { queryKeys } from '@/lib/queryClient';
import { backChevron } from '@/lib/rtl';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/notifications';
import type { NotificationRow } from '@/services/types';
import { useTheme } from '@/theme/ThemeProvider';

const ICONS: Record<string, string> = {
  streak_waiting: '🔥',
  streak_expiring: '⏳',
  streak_milestone: '🎉',
  post_reply: '💬',
  post_reaction: '❤️',
  new_message: '✉️',
  daily_question: '📊',
  university_trending: '🎓',
  badge_earned: '🏅',
  moderation: '⚠️',
};

export default function NotificationsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => fetchNotifications(50),
  });

  const markAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });

  const open = async (item: NotificationRow) => {
    if (!item.read_at) {
      await markNotificationRead(item.id);
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    }
    if (item.link) router.push(item.link as never);
  };

  const unreadCount = (data ?? []).filter((n) => !n.read_at).length;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { paddingHorizontal: theme.spacing.sm }]}>
        <IconButton icon={backChevron()} accessibilityLabel={t('a11y.back')} onPress={() => router.back()} />
        <Text variant="h2" style={{ flex: 1 }}>
          {t('notifications.title')}
        </Text>
        {unreadCount > 0 ? (
          <Button
            label={t('common.done')}
            variant="ghost"
            size="sm"
            loading={markAll.isPending}
            onPress={() => markAll.mutate()}
          />
        ) : null}
      </View>

      {isLoading ? (
        <ListSkeleton count={4} />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              // Notification text is stored as an i18n key plus params, so it
              // renders in the reader's language, not the sender's (§4).
              accessibilityLabel={t(item.title_key, item.params as Record<string, unknown>)}
              onPress={() => void open(item)}
              style={({ pressed }) => [
                styles.row,
                {
                  paddingHorizontal: theme.spacing.lg,
                  paddingVertical: theme.spacing.md,
                  gap: theme.spacing.md,
                  backgroundColor: pressed
                    ? theme.colors.surfacePressed
                    : item.read_at
                      ? 'transparent'
                      : theme.colors.accentSubtle,
                },
              ]}
            >
              <Text variant="h3">{ICONS[item.kind] ?? '🔔'}</Text>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="body">
                  {t(item.title_key, item.params as Record<string, unknown>)}
                </Text>
                <Text variant="micro" color="muted">
                  {formatRelative(item.created_at, i18n.language, t)}
                </Text>
              </View>
              {!item.read_at ? (
                <View style={[styles.dot, { backgroundColor: theme.colors.accent }]} />
              ) : null}
            </Pressable>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="notifications-outline"
              title={t('empty.notificationsTitle')}
              body={t('empty.notificationsBody')}
            />
          }
          ItemSeparatorComponent={() => (
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.divider }} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
