import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { SelectRow } from '@/components/ui/SelectRow';
import { OnboardingScaffold } from '@/features/onboarding/OnboardingScaffold';
import { usePreferences } from '@/store/preferences';
import { useTheme } from '@/theme/ThemeProvider';
import type { ThemePreference } from '@/theme/tokens';

const OPTIONS: { value: ThemePreference; labelKey: string }[] = [
  { value: 'light', labelKey: 'settings.themeLight' },
  { value: 'dark', labelKey: 'settings.themeDark' },
  { value: 'system', labelKey: 'settings.themeSystem' },
];

export default function AppearanceStep() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const preference = usePreferences((s) => s.themePreference);
  const setPreference = usePreferences((s) => s.setThemePreference);

  return (
    <OnboardingScaffold
      step={2}
      totalSteps={5}
      title={t('onboarding.appearanceTitle')}
      body={t('onboarding.appearanceBody')}
      footer={
        <Button
          label={t('common.next')}
          size="lg"
          fullWidth
          onPress={() => router.push('/(onboarding)/university')}
        />
      }
    >
      <View style={{ gap: theme.spacing.sm }}>
        {OPTIONS.map((option) => (
          <SelectRow
            key={option.value}
            label={t(option.labelKey)}
            selected={preference === option.value}
            onPress={() => setPreference(option.value)}
          />
        ))}
      </View>
    </OnboardingScaffold>
  );
}
