import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ListSkeleton } from '@/components/feedback/Skeleton';
import { BadgeGrid } from '@/features/profile/BadgeGrid';
import { ReportSheet } from '@/features/moderation/ReportSheet';
import { formatDate } from '@/lib/datetime';
import { errorTranslationKey } from '@/lib/errors';
import { queryKeys } from '@/lib/queryClient';
import { backChevron } from '@/lib/rtl';
import { openDirectConversation } from '@/services/messaging';
import { blockUser, fetchProfile } from '@/services/profiles';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme/ThemeProvider';

export default function PublicProfileScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { t, i18n } = useTranslation();

  const { id } = useLocalSearchParams<{ id: string }>();
  const myId = useSession((s) => s.profile?.id);
  const [reporting, setReporting] = useState(false);
  const [opening, setOpening] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.profile(id ?? ''),
    queryFn: () => fetchProfile(id!),
    enabled: !!id,
  });

  // Viewing your own profile through a link should show the editable one.
  if (id && myId && id === myId) {
    router.replace('/(tabs)/profile');
    return null;
  }

  const message = async () => {
    if (!id) return;
    setOpening(true);
    try {
      const conversation = await openDirectConversation(id);
      router.push(`/chat/${conversation.id}`);
    } catch (error) {
      toast.show(t(errorTranslationKey(error)), 'error');
    } finally {
      setOpening(false);
    }
  };

  const confirmBlock = () => {
    if (!data) return;
    Alert.alert(
      t('profile.blockConfirmTitle', { name: data.username }),
      t('profile.blockConfirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.block'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await blockUser(data.id);
                toast.show(t('moderation.blocked', { name: data.username }), 'success');
                router.back();
              } catch (error) {
                toast.show(t(errorTranslationKey(error)), 'error');
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { paddingHorizontal: theme.spacing.sm }]}>
        <IconButton icon={backChevron()} accessibilityLabel={t('a11y.back')} onPress={() => router.back()} />
        <View style={{ flex: 1 }} />
        <IconButton
          icon="flag-outline"
          accessibilityLabel={t('common.report')}
          onPress={() => setReporting(true)}
        />
        <IconButton icon="ban-outline" accessibilityLabel={t('common.block')} onPress={confirmBlock} />
      </View>

      {isLoading ? (
        <ListSkeleton count={2} />
      ) : !data ? (
        <EmptyState icon="person-outline" title={t('errors.notFound')} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: theme.spacing.giant }}
        >
          <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
            <Avatar uri={data.avatar_url} name={data.username} size={96} />
            <Text variant="h2">{data.display_name ?? `@${data.username}`}</Text>
            {data.display_name ? (
              <Text variant="caption" color="muted">
                @{data.username}
              </Text>
            ) : null}
            {data.bio ? (
              <Text variant="callout" color="secondary" align="center">
                {data.bio}
              </Text>
            ) : null}
            <Text variant="caption" color="muted">
              {t('profile.joined', { date: formatDate(data.created_at, i18n.language) })}
            </Text>

            <Button
              label={t('profile.message')}
              icon="chatbubble-outline"
              loading={opening}
              // The server still enforces this; hiding the button is courtesy,
              // not the control (§32).
              disabled={!data.allow_direct_messages}
              onPress={() => void message()}
            />
          </View>

          <View style={styles.statRow}>
            <Card style={{ flex: 1 }} elevation="none">
              <View style={{ alignItems: 'center', gap: 2 }}>
                <Text variant="h3">🔥 {data.longest_streak}</Text>
                <Text variant="micro" color="muted">
                  {t('profile.longestStreak')}
                </Text>
              </View>
            </Card>
            <Card style={{ flex: 1 }} elevation="none">
              <View style={{ alignItems: 'center', gap: 2 }}>
                <Text variant="h3">{data.post_count}</Text>
                <Text variant="micro" color="muted">
                  {t('profile.postsCount')}
                </Text>
              </View>
            </Card>
          </View>

          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="h3">{t('profile.badges')}</Text>
            <BadgeGrid userId={data.id} />
          </View>
        </ScrollView>
      )}

      <ReportSheet
        visible={reporting}
        target="user"
        targetId={id ?? null}
        onClose={() => setReporting(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 8 },
  statRow: { flexDirection: 'row', gap: 8 },
});
