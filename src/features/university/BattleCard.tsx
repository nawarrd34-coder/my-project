import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { Skeleton } from '@/components/feedback/Skeleton';
import { fetchBattle } from '@/services/universities';
import type { University } from '@/services/types';
import { useTheme } from '@/theme/ThemeProvider';

export interface BattleCardProps {
  a: University;
  b: University;
}

/**
 * Playful campus-vs-campus comparison (§20).
 *
 * The share is participation rate, not raw volume, so a smaller university is
 * not automatically the loser - which is what keeps this fun rather than
 * demoralising.
 */
export const BattleCard = ({ a, b }: BattleCardProps) => {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  const { data, isLoading } = useQuery({
    queryKey: ['battle', a.id, b.id],
    queryFn: () => fetchBattle(a.id, b.id),
    staleTime: 5 * 60_000,
  });

  if (isLoading) return <Skeleton height={120} radius={theme.radius.lg} />;

  const aShare = data?.a.share ?? 50;
  const bShare = data?.b.share ?? 50;

  const side = (university: University, share: number, color: string) => (
    <View style={{ flex: 1, gap: 4 }}>
      <Text variant="captionStrong" numberOfLines={1}>
        {isArabic ? university.short_name_ar : university.short_name_en}
      </Text>
      <Text variant="h2" style={{ color }}>
        🔥 {share}%
      </Text>
    </View>
  );

  return (
    <Card>
      <View style={{ gap: theme.spacing.md }}>
        <Text variant="micro" color="secondary">
          {t('university.battles').toUpperCase()}
        </Text>
        <View style={styles.row}>
          {side(a, aShare, a.brand_color)}
          <Text variant="caption" color="muted">
            vs
          </Text>
          {side(b, bShare, b.brand_color)}
        </View>
        <View style={[styles.bar, { borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceSunken }]}>
          <View style={{ flex: aShare, backgroundColor: a.brand_color }} />
          <View style={{ flex: bShare, backgroundColor: b.brand_color }} />
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bar: { flexDirection: 'row', height: 8, overflow: 'hidden' },
});
