import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';

import { Text } from './Text';
import { useTheme } from '@/theme/ThemeProvider';

export interface AvatarProps {
  uri?: string | null;
  /** Username or display name; used for the fallback initial and a11y label. */
  name?: string | null;
  size?: number;
  /** Renders the anonymous identity instead of a person (§24). */
  anonymous?: boolean;
  /** Stable per-user number behind "Anonymous #4821". */
  anonTag?: number | null;
  showOnlineDot?: boolean;
  isOnline?: boolean;
}

/** Deterministic hue so the same person always gets the same fallback colour. */
const hueFor = (seed: string): number => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  return hash;
};

export const Avatar = ({
  uri,
  name,
  size = 44,
  anonymous = false,
  anonTag,
  showOnlineDot = false,
  isOnline = false,
}: AvatarProps) => {
  const theme = useTheme();
  const { t } = useTranslation();

  const label = anonymous
    ? t('a11y.anonymousAvatar')
    : t('a11y.avatarOf', { name: name ?? t('common.anonymous') });

  const fallback = useMemo(() => {
    if (anonymous) return '?';
    const trimmed = (name ?? '').trim();
    // Take the first grapheme, which keeps Arabic initials correct.
    return trimmed ? [...trimmed][0]!.toUpperCase() : '?';
  }, [name, anonymous]);

  const seed = anonymous ? `anon-${anonTag ?? 0}` : (name ?? 'unknown');
  const hue = hueFor(seed);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.wrapper, { width: size, height: size }]}
    >
      {uri && !anonymous ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
          // Cached and progressively decoded; avoids the feed flashing (§35).
          transition={120}
          cachePolicy="memory-disk"
        />
      ) : (
        <View
          style={[
            styles.fallback,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: anonymous
                ? theme.colors.surfaceSunken
                : `hsl(${hue}, 62%, ${theme.mode === 'dark' ? 30 : 84}%)`,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text
            variant={size >= 56 ? 'h2' : size >= 40 ? 'h3' : 'captionStrong'}
            style={{
              color: anonymous
                ? theme.colors.textMuted
                : `hsl(${hue}, 70%, ${theme.mode === 'dark' ? 88 : 26}%)`,
            }}
          >
            {fallback}
          </Text>
        </View>
      )}

      {showOnlineDot ? (
        <View
          style={[
            styles.dot,
            {
              width: size * 0.28,
              height: size * 0.28,
              borderRadius: size * 0.14,
              backgroundColor: isOnline ? theme.colors.success : theme.colors.textMuted,
              borderColor: theme.colors.surface,
            },
          ]}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { position: 'relative' },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  dot: {
    position: 'absolute',
    bottom: 0,
    // `end` is direction-aware: bottom-right in LTR, bottom-left in RTL.
    insetInlineEnd: 0,
    borderWidth: 2,
  },
});
