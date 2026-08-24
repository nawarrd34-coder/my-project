import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from './Text';
import { useHaptics } from '@/hooks/useHaptics';
import { useTheme } from '@/theme/ThemeProvider';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export const Button = ({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  disabled,
  onPress,
  style,
  ...rest
}: ButtonProps) => {
  const theme = useTheme();
  const haptic = useHaptics();
  const isDisabled = disabled || loading;

  const sizing = {
    sm: { height: 36, paddingHorizontal: theme.spacing.md, variant: 'captionStrong' as const, icon: 15 },
    md: { height: 48, paddingHorizontal: theme.spacing.xl, variant: 'bodyStrong' as const, icon: 18 },
    lg: { height: 56, paddingHorizontal: theme.spacing.xxl, variant: 'h3' as const, icon: 20 },
  }[size];

  const palette = useMemo(() => {
    switch (variant) {
      case 'primary':
        return { bg: theme.colors.accent, pressed: theme.colors.accentPressed, fg: theme.colors.textOnAccent, border: 'transparent' };
      case 'secondary':
        return { bg: theme.colors.surfaceSunken, pressed: theme.colors.surfacePressed, fg: theme.colors.textPrimary, border: theme.colors.border };
      case 'ghost':
        return { bg: 'transparent', pressed: theme.colors.surfacePressed, fg: theme.colors.textPrimary, border: 'transparent' };
      case 'danger':
        return { bg: theme.colors.error, pressed: theme.colors.error, fg: theme.colors.textOnAccent, border: 'transparent' };
    }
  }, [variant, theme]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={(event) => {
        haptic(variant === 'danger' ? 'warning' : 'light');
        onPress?.(event);
      }}
      style={({ pressed }) => [
        styles.base,
        {
          height: sizing.height,
          paddingHorizontal: sizing.paddingHorizontal,
          backgroundColor: pressed && !isDisabled ? palette.pressed : palette.bg,
          borderColor: palette.border,
          borderRadius: theme.radius.md,
          opacity: isDisabled ? 0.5 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          // Never let a small button fall under the minimum touch target.
          minHeight: theme.minTouchTarget,
        },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} size="small" />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={sizing.icon} color={palette.fg} /> : null}
          <Text variant={sizing.variant} style={{ color: palette.fg }} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: {
    // `row` follows the layout direction, so icon+label mirror in Arabic.
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
