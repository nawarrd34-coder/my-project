import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { useTheme } from '@/theme/ThemeProvider';

export const SettingSection = ({ title, children }: { title?: string; children: ReactNode }) => {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.xs }}>
      {title ? (
        <Text
          variant="micro"
          color="muted"
          style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md }}
        >
          {title.toUpperCase()}
        </Text>
      ) : null}
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
          overflow: 'hidden',
          marginHorizontal: theme.spacing.lg,
        }}
      >
        {children}
      </View>
    </View>
  );
};
