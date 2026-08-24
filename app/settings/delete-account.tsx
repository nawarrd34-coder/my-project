import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';
import { SettingsScaffold } from '@/features/profile/SettingsScaffold';
import { errorTranslationKey } from '@/lib/errors';
import { deleteMyAccount } from '@/services/profiles';
import { usePreferences } from '@/store/preferences';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Account deletion (§39).
 *
 * Typing the confirmation word is a deliberate speed bump on an irreversible
 * action. The deletion itself is a server-side RPC that removes private data
 * and tombstones the profile, so nothing is left orphaned.
 */
export default function DeleteAccountScreen() {
  const theme = useTheme();
  const toast = useToast();
  const { t } = useTranslation();

  const resetPreferences = usePreferences((s) => s.reset);
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);

  const keyword = t('settings.deleteAccountKeyword');
  const confirmed = confirmation.trim().toUpperCase() === keyword.toUpperCase();

  const remove = async () => {
    setDeleting(true);
    try {
      // Signs out as part of the call, which sends AppGate back to onboarding.
      await deleteMyAccount();
      resetPreferences();
    } catch (error) {
      toast.show(t(errorTranslationKey(error)), 'error');
      setDeleting(false);
    }
  };

  return (
    <SettingsScaffold title={t('settings.deleteAccount')}>
      <View style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.lg }}>
        <Card style={{ borderColor: theme.colors.error, borderWidth: 1 }}>
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="h3" color="error">
              {t('settings.deleteAccountTitle')}
            </Text>
            <Text variant="callout" color="secondary">
              {t('settings.deleteAccountBody')}
            </Text>
          </View>
        </Card>

        <TextField
          label={t('settings.deleteAccountConfirm')}
          value={confirmation}
          onChangeText={setConfirmation}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder={keyword}
        />

        <Button
          label={deleting ? t('settings.deleting') : t('settings.deleteAccountCta')}
          variant="danger"
          size="lg"
          fullWidth
          disabled={!confirmed}
          loading={deleting}
          onPress={() => void remove()}
        />
      </View>
    </SettingsScaffold>
  );
}
