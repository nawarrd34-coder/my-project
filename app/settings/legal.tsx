import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/Text';
import { SettingsScaffold } from '@/features/profile/SettingsScaffold';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Legal documents.
 *
 * The text itself is not bundled: policies change independently of app
 * releases and must be reviewed by a human before publication, so this screen
 * renders whatever the deployment serves rather than a hardcoded draft.
 */
export default function LegalScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { doc } = useLocalSearchParams<{ doc?: string }>();

  const title = doc === 'privacy' ? t('settings.privacyPolicy') : t('settings.terms');

  return (
    <SettingsScaffold title={title}>
      <View style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md }}>
        <Text variant="body" color="secondary">
          {t('settings.help')}
        </Text>
        <Text variant="caption" color="muted">
          {/* Replace with the published URL for your deployment before release. */}
          {doc === 'privacy' ? 'https://unistreak.app/privacy' : 'https://unistreak.app/terms'}
        </Text>
      </View>
    </SettingsScaffold>
  );
}
