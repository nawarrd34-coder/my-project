import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';
import { SettingsScaffold } from '@/features/profile/SettingsScaffold';
import { errorTranslationKey } from '@/lib/errors';
import { submitReport } from '@/services/moderation';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme/ThemeProvider';

/** "Report a problem" (§38), routed through the same moderation queue. */
export default function SupportScreen() {
  const theme = useTheme();
  const toast = useToast();
  const { t } = useTranslation();

  const myId = useSession((s) => s.profile?.id);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!details.trim() || !myId) return;
    setSubmitting(true);
    try {
      await submitReport({
        target: 'user',
        reason: 'other',
        userId: myId,
        details: details.trim(),
      });
      toast.show(t('moderation.reportSent'), 'success');
      setDetails('');
    } catch (error) {
      toast.show(t(errorTranslationKey(error)), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SettingsScaffold title={t('settings.reportProblem')}>
      <View style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.lg }}>
        <Text variant="body" color="secondary">
          {t('moderation.reportBody')}
        </Text>
        <TextField
          value={details}
          onChangeText={setDetails}
          placeholder={t('moderation.reportDetails')}
          multiline
          maxLength={1000}
          style={{ minHeight: 140, textAlignVertical: 'top' }}
        />
        <Button
          label={t('moderation.reportSubmit')}
          size="lg"
          fullWidth
          disabled={!details.trim()}
          loading={submitting}
          onPress={() => void submit()}
        />
      </View>
    </SettingsScaffold>
  );
}
