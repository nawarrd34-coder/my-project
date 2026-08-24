import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { SelectRow } from '@/components/ui/SelectRow';
import { Text } from '@/components/ui/Text';
import { OnboardingScaffold } from '@/features/onboarding/OnboardingScaffold';
import { useLanguage } from '@/hooks/useLanguage';
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES } from '@/locales';
import { useTheme } from '@/theme/ThemeProvider';

export default function LanguageStep() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();

  return (
    <OnboardingScaffold
      step={1}
      totalSteps={5}
      title={t('onboarding.languageTitle')}
      body={t('onboarding.languageBody')}
      footer={
        <Button
          label={t('common.next')}
          size="lg"
          fullWidth
          onPress={() => router.push('/(onboarding)/appearance')}
        />
      }
    >
      <View style={{ gap: theme.spacing.sm }}>
        {SUPPORTED_LANGUAGES.map((code) => (
          <SelectRow
            key={code}
            label={LANGUAGE_LABELS[code]}
            selected={language === code}
            leading={<Text variant="h3">{code === 'ar' ? '🇸🇦' : '🇬🇧'}</Text>}
            // Switching to or from Arabic flips the layout direction, which
            // reloads the app; the choice is persisted first so the reload
            // comes back in the right language.
            onPress={() => void setLanguage(code)}
          />
        ))}
      </View>
    </OnboardingScaffold>
  );
}
