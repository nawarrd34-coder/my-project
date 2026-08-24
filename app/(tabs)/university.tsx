import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { StreakBadge } from '@/components/ui/StreakBadge';
import { Text } from '@/components/ui/Text';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { BattleCard } from '@/features/university/BattleCard';
import { DailyQuestionCard } from '@/features/university/DailyQuestionCard';
import { formatCompactNumber } from '@/lib/datetime';
import { errorTranslationKey } from '@/lib/errors';
import { queryKeys } from '@/lib/queryClient';
import {
  fetchCampusPulse,
  fetchChannels,
  fetchStudentLeaderboard,
  fetchUniversities,
  fetchUniversityLeaderboard,
} from '@/services/universities';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme/ThemeProvider';

type Board = 'universities' | 'students';

export default function UniversityScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  const profile = useSession((s) => s.profile);
  const universityId = profile?.university_id ?? '';
  const [board, setBoard] = useState<Board>('universities');

  const pulseQuery = useQuery({
    queryKey: queryKeys.pulse(universityId),
    queryFn: () => fetchCampusPulse(universityId),
    enabled: !!universityId,
  });

  const channelsQuery = useQuery({
    queryKey: queryKeys.channels(universityId),
    queryFn: () => fetchChannels(universityId),
    enabled: !!universityId,
  });

  const universitiesQuery = useQuery({
    queryKey: queryKeys.universities,
    queryFn: fetchUniversities,
  });

  const uniBoardQuery = useQuery({
    queryKey: queryKeys.leaderboardUniversities,
    queryFn: () => fetchUniversityLeaderboard(20),
    enabled: board === 'universities',
  });

  const studentBoardQuery = useQuery({
    queryKey: queryKeys.leaderboardStudents,
    queryFn: () => fetchStudentLeaderboard(20),
    enabled: board === 'students',
  });

  const myUniversity = useMemo(
    () => (universitiesQuery.data ?? []).find((u) => u.id === universityId) ?? null,
    [universitiesQuery.data, universityId],
  );

  /** Pair this campus against the next most active one for the battle card. */
  const rival = useMemo(() => {
    const others = (universitiesQuery.data ?? []).filter((u) => u.id !== universityId);
    return others.length > 0
      ? others.reduce((best, u) => (u.member_count > best.member_count ? u : best), others[0]!)
      : null;
  }, [universitiesQuery.data, universityId]);

  const boardChip = (value: Board, label: string) => (
    <Pressable
      key={value}
      accessibilityRole="tab"
      accessibilityState={{ selected: board === value }}
      accessibilityLabel={label}
      onPress={() => setBoard(value)}
      style={[
        styles.chip,
        {
          borderRadius: theme.radius.pill,
          backgroundColor: board === value ? theme.colors.accent : theme.colors.surfaceSunken,
        },
      ]}
    >
      <Text
        variant="captionStrong"
        style={{ color: board === value ? theme.colors.textOnAccent : theme.colors.textSecondary }}
      >
        {label}
      </Text>
    </Pressable>
  );

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
      <Text variant="h1">{t('university.title')}</Text>

      {pulseQuery.error ? (
        <ErrorState
          message={t(errorTranslationKey(pulseQuery.error))}
          onRetry={() => void pulseQuery.refetch()}
          compact
        />
      ) : null}

      {myUniversity ? (
        <Card>
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="h3">{isArabic ? myUniversity.name_ar : myUniversity.name_en}</Text>
            <View style={styles.row}>
              <StreakBadge
                count={pulseQuery.data?.university_streak ?? 0}
                status={(pulseQuery.data?.university_streak ?? 0) > 0 ? 'active' : 'pending'}
                size="md"
              />
              <Text variant="caption" color="secondary">
                {t('university.members', { count: myUniversity.member_count })}
              </Text>
            </View>
            <Text variant="caption" color="muted">
              {t('streaks.universityStreakBody')}
            </Text>
          </View>
        </Card>
      ) : (
        <Skeleton height={110} radius={theme.radius.lg} />
      )}

      {pulseQuery.data?.daily_question ? (
        <DailyQuestionCard question={pulseQuery.data.daily_question} />
      ) : null}

      {myUniversity && rival ? <BattleCard a={myUniversity} b={rival} /> : null}

      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="h3">{t('university.channels')}</Text>
        <View style={styles.channelGrid}>
          {(channelsQuery.data ?? []).map((channel) => (
            <Card
              key={channel.id}
              onPress={() => router.push('/(tabs)')}
              accessibilityLabel={isArabic ? channel.name_ar : channel.name_en}
              style={{ width: '48%' }}
              elevation="none"
            >
              <View style={{ gap: 4 }}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {isArabic ? channel.name_ar : channel.name_en}
                </Text>
                <Text variant="caption" color="muted">
                  {formatCompactNumber(channel.post_count, i18n.language)}
                </Text>
              </View>
            </Card>
          ))}
        </View>
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="h3">{t('university.leaderboard')}</Text>
        <View style={styles.filters}>
          {boardChip('universities', t('university.universityRanking'))}
          {boardChip('students', t('university.studentRanking'))}
        </View>

        {board === 'universities' ? (
          uniBoardQuery.isLoading ? (
            <Skeleton height={180} radius={theme.radius.lg} />
          ) : (
            <Card elevation="none">
              <View style={{ gap: theme.spacing.md }}>
                {(uniBoardQuery.data ?? []).map((row, index) => (
                  <View key={row.university_id} style={styles.rankRow}>
                    <Text variant="captionStrong" color="muted" style={{ width: 22 }}>
                      {index + 1}
                    </Text>
                    <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
                      {isArabic ? row.name_ar : row.name_en}
                    </Text>
                    <StreakBadge
                      count={row.streak_length}
                      status={row.streak_length > 0 ? 'active' : 'pending'}
                      size="sm"
                    />
                  </View>
                ))}
              </View>
            </Card>
          )
        ) : studentBoardQuery.isLoading ? (
          <Skeleton height={180} radius={theme.radius.lg} />
        ) : (
          <Card elevation="none">
            <View style={{ gap: theme.spacing.md }}>
              {(studentBoardQuery.data ?? []).map((row, index) => (
                <Pressable
                  key={row.user_id}
                  accessibilityRole="button"
                  accessibilityLabel={row.username}
                  onPress={() => router.push(`/profile/${row.user_id}`)}
                  style={styles.rankRow}
                >
                  <Text variant="captionStrong" color="muted" style={{ width: 22 }}>
                    {index + 1}
                  </Text>
                  <Avatar uri={row.avatar_url} name={row.username} size={32} />
                  <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
                    @{row.username}
                  </Text>
                  <Text variant="captionStrong" color="secondary">
                    🔥 {row.longest_streak}
                  </Text>
                </Pressable>
              ))}
              {(studentBoardQuery.data ?? []).length === 0 ? (
                <Text variant="caption" color="muted" align="center">
                  {t('university.hiddenFromLeaderboard')}
                </Text>
              ) : null}
            </View>
          </Card>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  channelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filters: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
