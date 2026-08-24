import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import type { ElevationLevel } from '@/theme/tokens';

export interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  elevation?: ElevationLevel;
  padded?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export const Card = ({
  children,
  onPress,
  elevation = 'sm',
  padded = true,
  style,
  accessibilityLabel,
}: CardProps) => {
  const theme = useTheme();

  const base: ViewStyle = {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderColor: theme.colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    padding: padded ? theme.spacing.lg : 0,
    ...theme.shadow(elevation),
  };

  if (!onPress) return <View style={[base, style]}>{children}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        base,
        pressed ? { backgroundColor: theme.colors.surfacePressed } : null,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
};
