import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { queryKeys } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Earned badges (§26).
 *
 * Badge names are stored as i18n keys rather than literal text, so a badge
 * reads correctly in whichever language the viewer is using (§4).
 */
export const BadgeGrid = ({ userId }: { userId: string }) => {
  const theme = useTheme();
  const { t } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.badges(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_badges')
        .select('badge_id, earned_at, badges(id, emoji, name_key, sort_order)')
        .eq('user_id', userId)
        .order('earned_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <Skeleton height={90} radius={theme.radius.lg} />;

  const badges = (data ?? []) as unknown as {
    badge_id: string;
    earned_at: string;
    badges: { id: string; emoji: string; name_key: string; sort_order: number } | null;
  }[];

  if (badges.length === 0) {
    return <EmptyState icon="ribbon-outline" title={t('empty.badgesTitle')} body={t('empty.badgesBody')} />;
  }

  return (
    <View style={styles.grid}>
      {badges.map((row) => (
        <Card key={row.badge_id} style={{ width: '48%' }} elevation="none">
          <View style={{ gap: 4 }}>
            <Text variant="h2">{row.badges?.emoji ?? '🏅'}</Text>
            <Text variant="captionStrong" numberOfLines={1}>
              {row.badges?.name_key ? t(row.badges.name_key) : row.badge_id}
            </Text>
          </View>
        </Card>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
