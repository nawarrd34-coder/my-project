import { FlatList, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ListSkeleton } from '@/components/feedback/Skeleton';
import { SettingsScaffold } from '@/features/profile/SettingsScaffold';
import { formatRelative } from '@/lib/datetime';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';

/** Append-only moderation audit trail (§30). */
export default function AdminLogScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_actions')
        .select('*, profiles!admin_actions_admin_id_fkey(username)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const rows = (data ?? []) as unknown as {
    id: string;
    action: string;
    target_type: string | null;
    note: string | null;
    created_at: string;
    profiles: { username: string } | null;
  }[];

  return (
    <SettingsScaffold title={t('admin.actionLog')}>
      {isLoading ? (
        <ListSkeleton count={3} />
      ) : (
        <FlatList
          scrollEnabled={false}
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm }}
          renderItem={({ item }) => (
            <Card elevation="none">
              <View style={{ gap: 2 }}>
                <Text variant="bodyStrong">{item.action}</Text>
                <Text variant="caption" color="secondary">
                  @{item.profiles?.username ?? '—'} · {item.target_type ?? '—'}
                </Text>
                {item.note ? (
                  <Text variant="caption" color="muted">
                    {item.note}
                  </Text>
                ) : null}
                <Text variant="micro" color="muted">
                  {formatRelative(item.created_at, i18n.language, t)}
                </Text>
              </View>
            </Card>
          )}
          ListEmptyComponent={<EmptyState icon="list-outline" title={t('empty.notificationsTitle')} />}
        />
      )}
    </SettingsScaffold>
  );
}
