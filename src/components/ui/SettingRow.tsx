import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from './Text';
import { forwardChevron } from '@/lib/rtl';
import { useTheme } from '@/theme/ThemeProvider';

interface BaseProps {
  label: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
}

type SettingRowProps =
  | (BaseProps & { kind: 'navigate'; onPress: () => void; value?: string })
  | (BaseProps & { kind: 'toggle'; value: boolean; onValueChange: (value: boolean) => void })
  | (BaseProps & { kind: 'action'; onPress: () => void });

/** One row in Settings: a link, a switch, or a destructive action (§38). */
export const SettingRow = (props: SettingRowProps) => {
  const theme = useTheme();
  const tint = props.destructive ? theme.colors.error : theme.colors.textPrimary;

  const content = (
    <>
      {props.icon ? (
        <Ionicons
          name={props.icon}
          size={20}
          color={props.destructive ? theme.colors.error : theme.colors.textSecondary}
        />
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body" style={{ color: tint }}>
          {props.label}
        </Text>
        {props.description ? (
          <Text variant="caption" color="muted">
            {props.description}
          </Text>
        ) : null}
      </View>

      {props.kind === 'toggle' ? (
        <Switch
          value={props.value}
          onValueChange={props.onValueChange}
          trackColor={{ true: theme.colors.accent, false: theme.colors.borderStrong }}
          thumbColor={theme.colors.surface}
          accessibilityLabel={props.label}
        />
      ) : props.kind === 'navigate' ? (
        <>
          {props.value ? (
            <Text variant="caption" color="muted">
              {props.value}
            </Text>
          ) : null}
          <Ionicons name={forwardChevron()} size={18} color={theme.colors.textMuted} />
        </>
      ) : null}
    </>
  );

  const rowStyle = {
    minHeight: theme.minTouchTarget + 8,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.md,
  };

  if (props.kind === 'toggle') {
    return <View style={[styles.row, rowStyle]}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.row,
        rowStyle,
        { backgroundColor: pressed ? theme.colors.surfacePressed : 'transparent' },
      ]}
    >
      {content}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
