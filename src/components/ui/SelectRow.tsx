import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from './Text';
import { useHaptics } from '@/hooks/useHaptics';
import { useTheme } from '@/theme/ThemeProvider';

export interface SelectRowProps {
  label: string;
  description?: string;
  selected?: boolean;
  onPress: () => void;
  leading?: React.ReactNode;
  /** Renders a checkbox tick instead of a radio dot. */
  multiple?: boolean;
  disabled?: boolean;
}

/** The selection primitive used by onboarding and settings. */
export const SelectRow = ({
  label,
  description,
  selected = false,
  onPress,
  leading,
  multiple = false,
  disabled = false,
}: SelectRowProps) => {
  const theme = useTheme();
  const haptic = useHaptics();

  return (
    <Pressable
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={label}
      accessibilityHint={description}
      disabled={disabled}
      onPress={() => {
        haptic('select');
        onPress();
      }}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: theme.minTouchTarget + 12,
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
          borderRadius: theme.radius.md,
          borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
          borderColor: selected ? theme.colors.accent : theme.colors.border,
          backgroundColor: pressed
            ? theme.colors.surfacePressed
            : selected
              ? theme.colors.accentSubtle
              : theme.colors.surface,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{label}</Text>
        {description ? (
          <Text variant="caption" color="secondary">
            {description}
          </Text>
        ) : null}
      </View>
      <Ionicons
        name={
          selected
            ? multiple ? 'checkbox' : 'radio-button-on'
            : multiple ? 'square-outline' : 'radio-button-off'
        }
        size={22}
        color={selected ? theme.colors.accent : theme.colors.textMuted}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
