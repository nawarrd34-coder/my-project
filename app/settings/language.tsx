import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SelectRow } from '@/components/ui/SelectRow';
import { Text } from '@/components/ui/Text';
import { SettingsScaffold } from '@/features/profile/SettingsScaffold';
import { useLanguage } from '@/hooks/useLanguage';
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES } from '@/locales';
import { useTheme } from '@/theme/ThemeProvider';

export default function LanguageSettings() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();

  return (
    <SettingsScaffold title={t('settings.language')}>
      <View style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm }}>
        {SUPPORTED_LANGUAGES.map((code) => (
          <SelectRow
            key={code}
            label={LANGUAGE_LABELS[code]}
            selected={language === code}
            leading={<Text variant="h3">{code === 'ar' ? '🇸🇦' : '🇬🇧'}</Text>}
            onPress={() => void setLanguage(code)}
          />
        ))}
        <Text variant="caption" color="muted">
          {t('onboarding.languageBody')}
        </Text>
      </View>
    </SettingsScaffold>
  );
}
