import { useMemo, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { ListSkeleton } from '@/components/feedback/Skeleton';
import { StreakCard } from '@/features/streaks/StreakCard';
import { bucketFor, type StreakBucket } from '@/features/streaks/format';
import { errorTranslationKey } from '@/lib/errors';
import { queryKeys } from '@/lib/queryClient';
import { fetchMyStreaks, restoreStreak } from '@/services/streaks';
import type { StreakWithPartner } from '@/services/types';
import { useTheme } from '@/theme/ThemeProvider';

const SECTION_ORDER: StreakBucket[] = ['expiring', 'active', 'new', 'past'];

const SECTION_TITLES: Record<StreakBucket, string> = {
  expiring: 'streaks.expiring',
  active: 'streaks.active',
  new: 'streaks.new',
  past: 'streaks.past',
};

export default function StreaksScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [helpOpen, setHelpOpen] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.streaks,
    queryFn: fetchMyStreaks,
    // Deadlines move; a stale streak list is worse than a small refetch.
    staleTime: 20_000,
  });

  const sections = useMemo(() => {
    const now = new Date();
    const grouped: Record<StreakBucket, StreakWithPartner[]> = {
      expiring: [],
      active: [],
      new: [],
      past: [],
    };

    for (const streak of data ?? []) {
      grouped[bucketFor(streak, now)].push(streak);
    }

    // Inside each bucket, the most urgent or longest first.
    grouped.expiring.sort(
      (a, b) => new Date(a.expiresAt ?? 0).getTime() - new Date(b.expiresAt ?? 0).getTime(),
    );
    grouped.active.sort((a, b) => b.currentLength - a.currentLength);
    grouped.past.sort((a, b) => b.longestLength - a.longestLength);

    return SECTION_ORDER.filter((bucket) => grouped[bucket].length > 0).map((bucket) => ({
      bucket,
      title: t(SECTION_TITLES[bucket]),
      data: grouped[bucket],
    }));
  }, [data, t]);

  const restore = async (streak: StreakWithPartner) => {
    setRestoringId(streak.id);
    try {
      await restoreStreak(streak.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.streaks });
      toast.show(t('streaks.restore'), 'success');
    } catch (error) {
      // The 24 hour window is enforced server-side; if it has closed the
      // message says so rather than the button silently doing nothing.
      toast.show(t(errorTranslationKey(error)), 'error');
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { padding: theme.spacing.lg }]}>
        <Text variant="h1" style={{ flex: 1 }}>
          {t('streaks.title')}
        </Text>
        <IconButton
          icon="help-circle-outline"
          accessibilityLabel={t('streaks.howItWorks')}
          onPress={() => setHelpOpen(true)}
        />
      </View>

      {isLoading ? (
        <ListSkeleton count={4} />
      ) : error ? (
        <ErrorState message={t(errorTranslationKey(error))} onRetry={() => void refetch()} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          renderSectionHeader={({ section }) => (
            <View
              style={{
                paddingHorizontal: theme.spacing.lg,
                paddingTop: theme.spacing.lg,
                paddingBottom: theme.spacing.sm,
                backgroundColor: theme.colors.background,
              }}
            >
              <Text variant="captionStrong" color="secondary">
                {section.title.toUpperCase()}
              </Text>
            </View>
          )}
          renderItem={({ item, section }) => (
            <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md }}>
              <StreakCard
                streak={item}
                variant={section.bucket}
                restoring={restoringId === item.id}
                onRestore={() => void restore(item)}
              />
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="flame-outline"
              title={t('empty.streaksTitle')}
              body={t('empty.streaksBody')}
              actionLabel={t('streaks.startStreak')}
              onAction={() => router.push('/chat/new')}
            />
          }
          stickySectionHeadersEnabled
          contentContainerStyle={{ paddingBottom: theme.spacing.giant }}
        />
      )}

      <BottomSheet visible={helpOpen} onClose={() => setHelpOpen(false)} title={t('streaks.howItWorks')}>
        <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.xxl }}>
          <Text variant="body" color="secondary">
            {t('streaks.howItWorksBody')}
          </Text>
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="callout">🔥 {t('streaks.pending')} — {t('streaks.pendingHint')}</Text>
            <Text variant="callout">🔥 2, 3, 4 …</Text>
            <Text variant="caption" color="muted">
              {t('streaks.universityStreakBody')}
            </Text>
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
});
