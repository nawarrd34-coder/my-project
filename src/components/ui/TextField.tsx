import { forwardRef, useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from './Text';
import { useTheme } from '@/theme/ThemeProvider';

export interface TextFieldProps extends TextInputProps {
  label?: string;
  /** Shown in the error colour beneath the field. */
  errorText?: string;
  /** Shown in muted colour beneath the field when there is no error. */
  helperText?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  trailing?: React.ReactNode;
  containerStyle?: ViewStyle;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, errorText, helperText, icon, trailing, containerStyle, style, ...rest },
  ref,
) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = errorText
    ? theme.colors.error
    : focused
      ? theme.colors.accent
      : theme.colors.border;

  return (
    <View style={[{ gap: theme.spacing.xs }, containerStyle]}>
      {label ? (
        <Text variant="captionStrong" color="secondary">
          {label}
        </Text>
      ) : null}

      <View
        style={[
          styles.field,
          {
            minHeight: theme.minTouchTarget + 4,
            paddingHorizontal: theme.spacing.md,
            gap: theme.spacing.sm,
            borderRadius: theme.radius.md,
            borderWidth: focused ? 2 : StyleSheet.hairlineWidth,
            borderColor,
            backgroundColor: theme.colors.surface,
          },
        ]}
      >
        {icon ? <Ionicons name={icon} size={18} color={theme.colors.textMuted} /> : null}
        <TextInput
          ref={ref}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          placeholderTextColor={theme.colors.textMuted}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          style={[
            theme.text('body'),
            styles.input,
            {
              color: theme.colors.textPrimary,
              // Follows the layout direction, so Arabic input starts at the
              // right without any conditional.
              textAlign: 'left',
            },
            style,
          ]}
        />
        {trailing}
      </View>

      {errorText ? (
        <Text variant="caption" color="error">
          {errorText}
        </Text>
      ) : helperText ? (
        <Text variant="caption" color="muted">
          {helperText}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, paddingVertical: 12 },
});
