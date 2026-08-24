import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ListSkeleton } from '@/components/feedback/Skeleton';
import { formatRelative } from '@/lib/datetime';
import { errorTranslationKey } from '@/lib/errors';
import { queryKeys } from '@/lib/queryClient';
import { backChevron } from '@/lib/rtl';
import { banUser, fetchReports, removePost, resolveReport } from '@/services/moderation';
import type { ReportRow } from '@/services/types';
import { useTheme } from '@/theme/ThemeProvider';

export default function AdminReportsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.reports('open'),
    queryFn: () => fetchReports('open'),
  });

  const act = useMutation({
    mutationFn: async ({ report, action }: { report: ReportRow; action: 'remove' | 'ban' | 'dismiss' }) => {
      if (action === 'remove' && report.post_id) {
        await removePost(report.post_id, `report:${report.id}`);
        await resolveReport(report.id, 'actioned', 'content removed');
        return;
      }
      if (action === 'ban' && report.reported_user_id) {
        // A first ban is time-boxed; a permanent ban is a deliberate second
        // decision rather than the default response to one report.
        await banUser({ userId: report.reported_user_id, reason: report.reason, duration: '7 days' });
        await resolveReport(report.id, 'actioned', 'user banned for 7 days');
        return;
      }
      await resolveReport(report.id, 'dismissed');
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.reports('open') });
      toast.show(t('admin.resolveReport'), 'success');
    },
    onError: (error) => toast.show(t(errorTranslationKey(error)), 'error'),
    onSettled: () => setBusyId(null),
  });

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { paddingHorizontal: theme.spacing.sm }]}>
        <IconButton icon={backChevron()} accessibilityLabel={t('a11y.back')} onPress={() => router.back()} />
        <Text variant="h2">{t('admin.reports')}</Text>
      </View>

      {isLoading ? (
        <ListSkeleton count={3} />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
          renderItem={({ item }) => (
            <Card>
              <View style={{ gap: theme.spacing.sm }}>
                <View style={styles.row}>
                  <Text variant="captionStrong" color="error">
                    {t(`moderation.reason${toPascal(item.reason)}`)}
                  </Text>
                  <View style={{ flex: 1 }} />
                  <Text variant="micro" color="muted">
                    {formatRelative(item.created_at, i18n.language, t)}
                  </Text>
                </View>
                <Text variant="caption" color="secondary">
                  {item.target} · {item.details ?? '—'}
                </Text>
                <View style={styles.actions}>
                  {item.post_id ? (
                    <Button
                      label={t('admin.removeContent')}
                      variant="danger"
                      size="sm"
                      loading={busyId === item.id}
                      onPress={() => {
                        setBusyId(item.id);
                        act.mutate({ report: item, action: 'remove' });
                      }}
                    />
                  ) : null}
                  {item.reported_user_id ? (
                    <Button
                      label={t('admin.banUser')}
                      variant="secondary"
                      size="sm"
                      loading={busyId === item.id}
                      onPress={() => {
                        setBusyId(item.id);
                        act.mutate({ report: item, action: 'ban' });
                      }}
                    />
                  ) : null}
                  <Button
                    label={t('admin.dismissReport')}
                    variant="ghost"
                    size="sm"
                    loading={busyId === item.id}
                    onPress={() => {
                      setBusyId(item.id);
                      act.mutate({ report: item, action: 'dismiss' });
                    }}
                  />
                </View>
              </View>
            </Card>
          )}
          ListEmptyComponent={
            <EmptyState icon="checkmark-done-outline" title={t('empty.notificationsTitle')} />
          }
        />
      )}
    </View>
  );
}

const toPascal = (value: string): string =>
  value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
