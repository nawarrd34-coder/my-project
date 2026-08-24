import { ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { Skeleton } from '@/components/feedback/Skeleton';
import { formatCompactNumber } from '@/lib/datetime';
import type { CampusPulse } from '@/services/types';
import { useTheme } from '@/theme/ThemeProvider';

export interface CampusPulseHeaderProps {
  pulse: CampusPulse | undefined;
  universityName: string;
  loading: boolean;
}

/**
 * The Home header (§8/§22): university name, today's activity, and the rails
 * that make the campus feel alive. Every number comes from one `campus_pulse`
 * round trip rather than a query per rail.
 */
export const CampusPulseHeader = ({ pulse, universityName, loading }: CampusPulseHeaderProps) => {
  const theme = useTheme();
  const router = useRouter();
  const { t, i18n } = useTranslation();

  if (loading || !pulse) {
    return (
      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
        <Skeleton height={92} radius={theme.radius.lg} />
        <Skeleton height={120} radius={theme.radius.lg} />
      </View>
    );
  }

  const stats = [
    { label: t('home.pulseTitle'), value: formatCompactNumber(pulse.online_now, i18n.language), icon: '🟢' },
    { label: t('post.create'), value: formatCompactNumber(pulse.posts_today, i18n.language), icon: '✍️' },
    { label: t('chats.title'), value: formatCompactNumber(pulse.messages_today, i18n.language), icon: '💬' },
  ];

  return (
    <View style={{ gap: theme.spacing.md, padding: theme.spacing.lg }}>
      <LinearGradient
        colors={[theme.colors.streakFrom, theme.colors.streakTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { borderRadius: theme.radius.lg, padding: theme.spacing.lg }]}
      >
        <Text variant="micro" style={{ color: 'rgba(255,255,255,0.85)' }}>
          {t('common.appName').toUpperCase()}
        </Text>
        <Text variant="h1" style={{ color: '#FFFFFF' }} numberOfLines={1}>
          {universityName}
        </Text>
        <View style={styles.heroRow}>
          <Text variant="h3" style={{ color: '#FFFFFF' }}>
            🔥 {t('home.activeToday', { count: pulse.active_today })}
          </Text>
        </View>
        {pulse.university_streak > 0 ? (
          <Text variant="caption" style={{ color: 'rgba(255,255,255,0.9)' }}>
            {t('streaks.universityStreak', { count: pulse.university_streak })}
          </Text>
        ) : null}
      </LinearGradient>

      <View style={styles.statRow}>
        {stats.map((stat) => (
          <Card key={stat.label} style={{ flex: 1 }} elevation="none">
            <View style={{ gap: 2, alignItems: 'flex-start' }}>
              <Text variant="callout">{stat.icon}</Text>
              <Text variant="h3">{stat.value}</Text>
              <Text variant="micro" color="muted" numberOfLines={1}>
                {stat.label}
              </Text>
            </View>
          </Card>
        ))}
      </View>

      {pulse.daily_question ? (
        <Card onPress={() => router.push('/university')} accessibilityLabel={t('dailyQuestion.title')}>
          <View style={{ gap: theme.spacing.xs }}>
            <Text variant="micro" color="accent">
              {t('home.questionOfTheDay').toUpperCase()}
            </Text>
            <Text variant="bodyStrong">
              {i18n.language === 'ar'
                ? pulse.daily_question.question_ar
                : pulse.daily_question.question_en}
            </Text>
            <Text variant="caption" color="muted">
              {pulse.daily_question.answered
                ? t('dailyQuestion.voted')
                : t('dailyQuestion.totalVotes', { count: pulse.daily_question.vote_count })}
            </Text>
          </View>
        </Card>
      ) : null}

      {pulse.active_groups.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="captionStrong" color="secondary">
            {t('home.activeChats')}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: theme.spacing.sm }}
          >
            {pulse.active_groups.map((group) => (
              <Card
                key={group.id}
                onPress={() => router.push(`/chat/${group.id}`)}
                accessibilityLabel={group.title ?? ''}
                style={{ width: 160 }}
              >
                <View style={{ gap: 4 }}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {group.title}
                  </Text>
                  <Text variant="caption" color="muted">
                    {t('chats.members', { count: group.member_count })}
                  </Text>
                </View>
              </Card>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  hero: { gap: 4 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  statRow: { flexDirection: 'row', gap: 8 },
});
