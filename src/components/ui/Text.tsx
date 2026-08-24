import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import type { TypographyVariant } from '@/theme/tokens';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  /** Semantic colour token name, or an explicit colour. */
  color?: 'primary' | 'secondary' | 'muted' | 'accent' | 'error' | 'success' | 'inverse' | 'onAccent';
  align?: TextStyle['textAlign'];
  weight?: TextStyle['fontWeight'];
}

/**
 * The only text primitive in the app. Using it everywhere guarantees that
 * type scale, colour and RTL alignment stay consistent, and that OS font
 * scaling works (§42).
 *
 * `textAlign: 'left'` is resolved by React Native against the layout
 * direction, so Arabic text right-aligns without any conditional.
 */
export const Text = ({
  variant = 'body',
  color = 'primary',
  align,
  weight,
  style,
  ...rest
}: TextProps) => {
  const theme = useTheme();
  const base = theme.text(variant);

  const colorValue = {
    primary: theme.colors.textPrimary,
    secondary: theme.colors.textSecondary,
    muted: theme.colors.textMuted,
    accent: theme.colors.accentText,
    error: theme.colors.error,
    success: theme.colors.success,
    inverse: theme.colors.textInverse,
    onAccent: theme.colors.textOnAccent,
  }[color];

  return (
    <RNText
      {...rest}
      style={[
        base,
        { color: colorValue },
        align ? { textAlign: align } : null,
        weight ? { fontWeight: weight } : null,
        style,
      ]}
    />
  );
};
