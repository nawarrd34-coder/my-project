import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';

export interface OnboardingScaffoldProps {
  step: number;
  totalSteps: number;
  title: string;
  body?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Shared frame for every onboarding step: progress, heading, scroll, footer. */
export const OnboardingScaffold = ({
  step,
  totalSteps,
  title,
  body,
  children,
  footer,
}: OnboardingScaffoldProps) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <View style={[styles.progressRow, { padding: theme.spacing.lg, gap: theme.spacing.xs }]}>
        {Array.from({ length: totalSteps }, (_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: i < step ? theme.colors.accent : theme.colors.surfaceSunken,
            }}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.xl,
          paddingBottom: theme.spacing.xxxl,
          gap: theme.spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="micro" color="muted">
            {t('onboarding.step', { current: step, total: totalSteps })}
          </Text>
          <Text variant="display">{title}</Text>
          {body ? (
            <Text variant="body" color="secondary">
              {body}
            </Text>
          ) : null}
        </View>
        {children}
      </ScrollView>

      {footer ? (
        <View
          style={{
            padding: theme.spacing.xl,
            paddingBottom: insets.bottom + theme.spacing.lg,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: theme.colors.divider,
            backgroundColor: theme.colors.backgroundElevated,
            gap: theme.spacing.md,
          }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  progressRow: { flexDirection: 'row' },
});
