import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useHaptics } from '@/hooks/useHaptics';
import { useTheme } from '@/theme/ThemeProvider';

export interface IconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  /** Required: an icon with no label is invisible to a screen reader (§42). */
  accessibilityLabel: string;
  size?: number;
  color?: string;
  background?: 'none' | 'surface' | 'accent';
  disabled?: boolean;
  style?: ViewStyle;
}

export const IconButton = ({
  icon,
  onPress,
  accessibilityLabel,
  size = 22,
  color,
  background = 'none',
  disabled = false,
  style,
}: IconButtonProps) => {
  const theme = useTheme();
  const haptic = useHaptics();

  const bg = {
    none: 'transparent',
    surface: theme.colors.surfaceSunken,
    accent: theme.colors.accent,
  }[background];

  const fg = color ?? (background === 'accent' ? theme.colors.textOnAccent : theme.colors.textSecondary);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => {
        haptic('light');
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.base,
        {
          width: Math.max(theme.minTouchTarget, size + 20),
          height: Math.max(theme.minTouchTarget, size + 20),
          borderRadius: theme.radius.pill,
          backgroundColor: pressed ? theme.colors.surfacePressed : bg,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={size} color={fg} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
