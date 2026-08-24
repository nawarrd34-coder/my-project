import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';

export interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Every list gets one of these rather than an unexplained blank screen (§36). */
export const EmptyState = ({ icon = 'sparkles', title, body, actionLabel, onAction }: EmptyStateProps) => {
  const theme = useTheme();
  return (
    <View style={[styles.wrapper, { padding: theme.spacing.xxxl, gap: theme.spacing.md }]}>
      <View
        style={[
          styles.iconRing,
          { backgroundColor: theme.colors.surfaceSunken, borderRadius: theme.radius.pill },
        ]}
      >
        <Ionicons name={icon} size={26} color={theme.colors.textMuted} />
      </View>
      <Text variant="h3" align="center">
        {title}
      </Text>
      {body ? (
        <Text variant="callout" color="secondary" align="center">
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} variant="secondary" onPress={onAction} />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
  iconRing: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
});
