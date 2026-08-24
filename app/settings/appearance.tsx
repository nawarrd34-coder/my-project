import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SelectRow } from '@/components/ui/SelectRow';
import { SettingsScaffold } from '@/features/profile/SettingsScaffold';
import { usePreferences } from '@/store/preferences';
import { useTheme } from '@/theme/ThemeProvider';
import type { ThemePreference } from '@/theme/tokens';

const OPTIONS: { value: ThemePreference; key: string }[] = [
  { value: 'light', key: 'settings.themeLight' },
  { value: 'dark', key: 'settings.themeDark' },
  { value: 'system', key: 'settings.themeSystem' },
];

export default function AppearanceSettings() {
  const theme = useTheme();
  const { t } = useTranslation();
  const preference = usePreferences((s) => s.themePreference);
  const setPreference = usePreferences((s) => s.setThemePreference);

  return (
    <SettingsScaffold title={t('settings.appearance')}>
      <View style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm }}>
        {OPTIONS.map((option) => (
          <SelectRow
            key={option.value}
            label={t(option.key)}
            selected={preference === option.value}
            onPress={() => setPreference(option.value)}
          />
        ))}
      </View>
    </SettingsScaffold>
  );
}
