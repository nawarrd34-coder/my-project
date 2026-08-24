import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { SettingRow } from '@/components/ui/SettingRow';
import { SettingSection } from '@/components/ui/SettingSection';
import { Text } from '@/components/ui/Text';
import { Skeleton } from '@/components/feedback/Skeleton';
import { queryKeys } from '@/lib/queryClient';
import { backChevron } from '@/lib/rtl';
import { fetchReports } from '@/services/moderation';
import { fetchCampusPulse } from '@/services/universities';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme/ThemeProvider';

export default function AdminDashboard() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();

  const profile = useSession((s) => s.profile);
  const universityId = profile?.university_id ?? '';
  const isSuperAdmin = profile?.role === 'super_admin';
  const isUniversityAdmin = isSuperAdmin || profile?.role === 'university_admin';

  const pulseQuery = useQuery({
    queryKey: queryKeys.adminStats(universityId),
    queryFn: () => fetchCampusPulse(universityId),
    enabled: !!universityId,
  });

  const reportsQuery = useQuery({
    queryKey: queryKeys.reports('open'),
    queryFn: () => fetchReports('open'),
  });

  const openReports = reportsQuery.data?.length ?? 0;

  const stats = [
    { label: t('admin.activeUsers'), value: pulseQuery.data?.active_today ?? 0 },
    { label: t('admin.postsToday'), value: pulseQuery.data?.posts_today ?? 0 },
    { label: t('admin.messagesToday'), value: pulseQuery.data?.messages_today ?? 0 },
  ];

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ paddingBottom: theme.spacing.giant, gap: theme.spacing.md }}
    >
      <View style={[styles.header, { paddingTop: insets.top + 4, paddingHorizontal: theme.spacing.sm }]}>
        <IconButton icon={backChevron()} accessibilityLabel={t('a11y.back')} onPress={() => router.back()} />
        <Text variant="h2" style={{ flex: 1 }}>
          {t('admin.title')}
        </Text>
      </View>

      <View style={[styles.statRow, { paddingHorizontal: theme.spacing.lg }]}>
        {pulseQuery.isLoading
          ? Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} height={72} radius={theme.radius.lg} style={{ flex: 1 }} />
            ))
          : stats.map((stat) => (
              <Card key={stat.label} style={{ flex: 1 }} elevation="none">
                <View style={{ alignItems: 'center', gap: 2 }}>
                  <Text variant="h3">{stat.value}</Text>
                  <Text variant="micro" color="muted" numberOfLines={1}>
                    {stat.label}
                  </Text>
                </View>
              </Card>
            ))}
      </View>

      <SettingSection title={t('admin.dashboard')}>
        <SettingRow
          kind="navigate"
          icon="flag-outline"
          label={t('admin.reports')}
          value={openReports > 0 ? String(openReports) : undefined}
          onPress={() => router.push('/admin/reports')}
        />
        {isUniversityAdmin ? (
          <SettingRow
            kind="navigate"
            icon="help-circle-outline"
            label={t('admin.dailyQuestion')}
            onPress={() => router.push('/admin/daily-question')}
          />
        ) : null}
        {isUniversityAdmin ? (
          <SettingRow
            kind="navigate"
            icon="options-outline"
            label={t('admin.streakThreshold')}
            description={t('admin.streakThresholdBody')}
            onPress={() => router.push('/admin/university')}
          />
        ) : null}
        <SettingRow
          kind="navigate"
          icon="list-outline"
          label={t('admin.actionLog')}
          onPress={() => router.push('/admin/log')}
        />
      </SettingSection>

      <Text variant="caption" color="muted" align="center">
        {profile?.role}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 8 },
  statRow: { flexDirection: 'row', gap: 8 },
});
