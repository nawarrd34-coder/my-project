import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { Text } from './Text';
import { useTheme } from '@/theme/ThemeProvider';
import { formatStreakCount } from '@/features/streaks/format';

export interface StreakBadgeProps {
  /** 0 means the streak exists but has not been counted yet (§14). */
  count: number;
  status: 'pending' | 'active' | 'expired' | 'restored';
  size?: 'sm' | 'md' | 'lg';
  /** Plays the grow animation. Set when the value has just increased (§16). */
  animate?: boolean;
}

/**
 * The fire indicator. `🔥 Pending` on day one, then `🔥 2`, `🔥 3`, ... The
 * count never renders as 1, because the engine never stores 1 (§14).
 */
export const StreakBadge = ({ count, status, size = 'md', animate = false }: StreakBadgeProps) => {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!animate || theme.reducedMotion) return;
    scale.value = withSequence(
      withTiming(1.28, { duration: theme.duration.fast }),
      withSpring(1, { damping: 9, stiffness: 220 }),
    );
  }, [animate, count, scale, theme.duration.fast, theme.reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const isPending = status === 'pending' || count === 0;
  const isExpired = status === 'expired';

  const sizing = {
    sm: { pv: 2, ph: 6, variant: 'micro' as const, gap: 3 },
    md: { pv: 4, ph: 8, variant: 'captionStrong' as const, gap: 4 },
    lg: { pv: 6, ph: 12, variant: 'h3' as const, gap: 6 },
  }[size];

  const tint = isExpired
    ? theme.colors.textMuted
    : isPending
      ? theme.colors.streakPending
      : theme.colors.streak;

  const label = isPending
    ? t('streaks.pending')
    : formatStreakCount(count, i18n.language);

  return (
    <Animated.View
      style={[animatedStyle]}
      accessibilityRole="text"
      accessibilityLabel={
        isPending ? t('a11y.streakPending') : t('a11y.streakBadge', { count })
      }
    >
      <View
        style={[
          styles.pill,
          {
            paddingVertical: sizing.pv,
            paddingHorizontal: sizing.ph,
            gap: sizing.gap,
            borderRadius: theme.radius.pill,
            backgroundColor: isExpired ? theme.colors.surfaceSunken : theme.colors.streakSubtle,
          },
        ]}
      >
        <Text variant={sizing.variant} style={{ opacity: isExpired ? 0.5 : 1 }}>
          🔥
        </Text>
        <Text variant={sizing.variant} style={{ color: tint }}>
          {label}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center' },
});
