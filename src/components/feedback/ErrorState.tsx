import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';

export interface ErrorStateProps {
  /** Already-localized message; use `describeError` to produce one. */
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}

/** Paired with `describeError`, this is the retry surface for every screen (§36). */
export const ErrorState = ({ message, onRetry, compact = false }: ErrorStateProps) => {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View
      style={[
        styles.wrapper,
        { padding: compact ? theme.spacing.lg : theme.spacing.xxxl, gap: theme.spacing.md },
      ]}
    >
      <Ionicons name="cloud-offline-outline" size={compact ? 22 : 30} color={theme.colors.error} />
      <Text variant={compact ? 'callout' : 'h3'} align="center">
        {message ?? t('errors.generic')}
      </Text>
      {onRetry ? (
        <Button label={t('common.retry')} variant="secondary" size={compact ? 'sm' : 'md'} onPress={onRetry} />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center' },
});
