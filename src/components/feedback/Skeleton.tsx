import { useEffect } from 'react';
import { View, type DimensionValue, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

/** A single shimmering block. Compose these into screen-shaped placeholders. */
export const Skeleton = ({ width = '100%', height = 14, radius, style }: SkeletonProps) => {
  const theme = useTheme();
  const pulse = useSharedValue(0.55);

  useEffect(() => {
    if (theme.reducedMotion) return;
    pulse.value = withRepeat(withTiming(1, { duration: 780 }), -1, true);
  }, [pulse, theme.reducedMotion]);

  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        animated,
        {
          width,
          height,
          borderRadius: radius ?? theme.radius.sm,
          backgroundColor: theme.colors.skeleton,
        },
        style,
      ]}
    />
  );
};

/** Feed-shaped placeholder, so the first paint matches the real layout (§35). */
export const PostCardSkeleton = () => {
  const theme = useTheme();
  return (
    <View
      style={{
        padding: theme.spacing.lg,
        gap: theme.spacing.md,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.lg,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <Skeleton width={40} height={40} radius={20} />
        <View style={{ gap: 6, flex: 1 }}>
          <Skeleton width="45%" height={12} />
          <Skeleton width="25%" height={10} />
        </View>
      </View>
      <Skeleton height={12} />
      <Skeleton width="80%" height={12} />
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <Skeleton width={54} height={28} radius={14} />
        <Skeleton width={54} height={28} radius={14} />
        <Skeleton width={54} height={28} radius={14} />
      </View>
    </View>
  );
};

export const ListSkeleton = ({ count = 4 }: { count?: number }) => {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.md, padding: theme.spacing.lg }}>
      {Array.from({ length: count }, (_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </View>
  );
};
