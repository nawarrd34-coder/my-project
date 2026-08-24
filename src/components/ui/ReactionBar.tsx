import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { Text } from './Text';
import { useHaptics } from '@/hooks/useHaptics';
import { REACTION_EMOJIS, type ReactionEmoji } from '@/services/types';
import { useTheme } from '@/theme/ThemeProvider';

export interface ReactionBarProps {
  counts: Record<string, number>;
  /** The emoji the viewer currently holds, if any. */
  mine: string | null;
  onReact: (emoji: ReactionEmoji) => void;
  /** Compact mode hides the picker and only shows existing reactions. */
  readOnly?: boolean;
}

/**
 * Reaction row (§11). Tapping an existing chip toggles it; the "+" opens the
 * full picker. Counts come from the server but update optimistically so the
 * tap feels instant.
 */
export const ReactionBar = ({ counts, mine, onReact, readOnly = false }: ReactionBarProps) => {
  const theme = useTheme();
  const haptic = useHaptics();
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);

  const present = REACTION_EMOJIS.filter((emoji) => (counts[emoji] ?? 0) > 0);

  const react = (emoji: ReactionEmoji) => {
    haptic('light');
    setPickerOpen(false);
    onReact(emoji);
  };

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={styles.row}>
        {present.map((emoji) => {
          const isMine = mine === emoji;
          return (
            <Animated.View key={emoji} entering={theme.reducedMotion ? undefined : ZoomIn.duration(theme.duration.fast)}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('a11y.reactionCount', { emoji, count: counts[emoji] ?? 0 })}
                accessibilityState={{ selected: isMine }}
                disabled={readOnly}
                onPress={() => react(emoji)}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    borderRadius: theme.radius.pill,
                    paddingVertical: 5,
                    paddingHorizontal: 10,
                    backgroundColor: isMine ? theme.colors.accentSubtle : theme.colors.surfaceSunken,
                    borderColor: isMine ? theme.colors.accent : 'transparent',
                    borderWidth: 1,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text variant="caption">{emoji}</Text>
                <Text variant="captionStrong" color={isMine ? 'accent' : 'secondary'}>
                  {counts[emoji] ?? 0}
                </Text>
              </Pressable>
            </Animated.View>
          );
        })}

        {!readOnly ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('post.reactionsCount', { count: present.length })}
            onPress={() => {
              haptic('select');
              setPickerOpen((open) => !open);
            }}
            style={[
              styles.chip,
              {
                borderRadius: theme.radius.pill,
                paddingVertical: 5,
                paddingHorizontal: 10,
                backgroundColor: theme.colors.surfaceSunken,
              },
            ]}
          >
            <Text variant="caption" color="secondary">
              {pickerOpen ? '×' : '＋'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {pickerOpen && !readOnly ? (
        <Animated.View entering={theme.reducedMotion ? undefined : FadeIn.duration(theme.duration.fast)}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: theme.spacing.xs }}
          >
            {REACTION_EMOJIS.map((emoji) => (
              <Pressable
                key={emoji}
                accessibilityRole="button"
                accessibilityLabel={
                  mine === emoji ? t('a11y.removeReaction', { emoji }) : t('a11y.reactWith', { emoji })
                }
                onPress={() => react(emoji)}
                style={({ pressed }) => [
                  styles.pickerItem,
                  {
                    borderRadius: theme.radius.pill,
                    backgroundColor: mine === emoji ? theme.colors.accentSubtle : theme.colors.surfaceSunken,
                    transform: [{ scale: pressed ? 0.9 : 1 }],
                    minWidth: theme.minTouchTarget,
                    minHeight: theme.minTouchTarget,
                  },
                ]}
              >
                <Text variant="h3">{emoji}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pickerItem: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
});
