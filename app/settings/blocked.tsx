import { FlatList, StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ListSkeleton } from '@/components/feedback/Skeleton';
import { SettingsScaffold } from '@/features/profile/SettingsScaffold';
import { errorTranslationKey } from '@/lib/errors';
import { queryKeys } from '@/lib/queryClient';
import { fetchBlockedUsers, unblockUser } from '@/services/profiles';
import { useTheme } from '@/theme/ThemeProvider';

export default function BlockedUsersScreen() {
  const theme = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.blockedUsers,
    queryFn: fetchBlockedUsers,
  });

  const mutation = useMutation({
    mutationFn: (userId: string) => unblockUser(userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.blockedUsers });
      // Unblocking restores their content to the feed, so refresh it too.
      await queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
    onError: (error) => toast.show(t(errorTranslationKey(error)), 'error'),
  });

  return (
    <SettingsScaffold title={t('settings.blockedUsers')}>
      {isLoading ? (
        <ListSkeleton count={2} />
      ) : (
        <FlatList
          scrollEnabled={false}
          data={data ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View
              style={[
                styles.row,
                { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, gap: theme.spacing.md },
              ]}
            >
              <Avatar uri={item.avatar_url} name={item.username} size={40} />
              <Text variant="body" style={{ flex: 1 }}>
                @{item.username}
              </Text>
              <Button
                label={t('common.unblock')}
                variant="secondary"
                size="sm"
                loading={mutation.isPending && mutation.variables === item.id}
                onPress={() => mutation.mutate(item.id)}
              />
            </View>
          )}
          ListEmptyComponent={
            <EmptyState icon="ban-outline" title={t('empty.blockedTitle')} body={t('empty.blockedBody')} />
          }
        />
      )}
    </SettingsScaffold>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
