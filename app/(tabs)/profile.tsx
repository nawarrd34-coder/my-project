import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { BadgeGrid } from '@/features/profile/BadgeGrid';
import { formatDate } from '@/lib/datetime';
import { queryKeys } from '@/lib/queryClient';
import { fetchMyStreaks } from '@/services/streaks';
import { useSession, selectIsStaff } from '@/store/session';
import { useTheme } from '@/theme/ThemeProvider';

export default function ProfileScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, i18n } = useTranslation();

  const profile = useSession((s) => s.profile);
  const isStaff = useSession(selectIsStaff);

  const { data: streaks } = useQuery({
    queryKey: queryKeys.streaks,
    queryFn: fetchMyStreaks,
    staleTime: 30_000,
  });

  const activeStreaks = (streaks ?? []).filter((s) => s.status !== 'expired').length;

  if (!profile) return null;

  const stats = [
    { label: t('profile.longestStreak'), value: `🔥 ${profile.longest_streak}` },
    { label: t('profile.currentStreaks'), value: String(activeStreaks) },
    { label: t('profile.postsCount'), value: String(profile.post_count) },
  ];

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{
        paddingTop: insets.top + theme.spacing.md,
        padding: theme.spacing.lg,
        gap: theme.spacing.lg,
        paddingBottom: theme.spacing.giant,
      }}
    >
      <View style={styles.topRow}>
        <Text variant="h1" style={{ flex: 1 }}>
          {t('profile.title')}
        </Text>
        {isStaff ? (
          <IconButton
            icon="shield-checkmark-outline"
            accessibilityLabel={t('admin.title')}
            onPress={() => router.push('/admin')}
          />
        ) : null}
        <IconButton
          icon="settings-outline"
          accessibilityLabel={t('settings.title')}
          onPress={() => router.push('/settings')}
        />
      </View>

      <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
        <Avatar uri={profile.avatar_url} name={profile.username} size={96} />
        <Text variant="h2">{profile.display_name ?? `@${profile.username}`}</Text>
        {profile.display_name ? (
          <Text variant="caption" color="muted">
            @{profile.username}
          </Text>
        ) : null}
        {profile.bio ? (
          <Text variant="callout" color="secondary" align="center">
            {profile.bio}
          </Text>
        ) : null}
        <Text variant="caption" color="muted">
          {t('profile.joined', { date: formatDate(profile.created_at, i18n.language) })}
        </Text>
        <Button
          label={t('profile.editProfile')}
          variant="secondary"
          size="sm"
          icon="create-outline"
          onPress={() => router.push('/settings/account')}
        />
      </View>

      <View style={styles.statRow}>
        {stats.map((stat) => (
          <Card key={stat.label} style={{ flex: 1 }} elevation="none">
            <View style={{ gap: 2, alignItems: 'center' }}>
              <Text variant="h3">{stat.value}</Text>
              <Text variant="micro" color="muted" numberOfLines={1}>
                {stat.label}
              </Text>
            </View>
          </Card>
        ))}
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="h3">{t('profile.badges')}</Text>
        <BadgeGrid userId={profile.id} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statRow: { flexDirection: 'row', gap: 8 },
});
