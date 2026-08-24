import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { SelectRow } from '@/components/ui/SelectRow';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';
import { errorTranslationKey } from '@/lib/errors';
import { submitReport } from '@/services/moderation';
import type { ReportReason, ReportTarget } from '@/services/types';
import { useTheme } from '@/theme/ThemeProvider';

const REASONS: { value: ReportReason; key: string }[] = [
  { value: 'spam', key: 'moderation.reasonSpam' },
  { value: 'harassment', key: 'moderation.reasonHarassment' },
  { value: 'hate', key: 'moderation.reasonHate' },
  { value: 'sexual', key: 'moderation.reasonSexual' },
  { value: 'violence', key: 'moderation.reasonViolence' },
  { value: 'self_harm', key: 'moderation.reasonSelfHarm' },
  { value: 'impersonation', key: 'moderation.reasonImpersonation' },
  { value: 'misinformation', key: 'moderation.reasonMisinformation' },
  { value: 'other', key: 'moderation.reasonOther' },
];

export interface ReportSheetProps {
  visible: boolean;
  target: ReportTarget;
  targetId: string | null;
  onClose: () => void;
}

/** Report flow for posts, comments, messages, users and groups (§29). */
export const ReportSheet = ({ visible, target, targetId, onClose }: ReportSheetProps) => {
  const theme = useTheme();
  const toast = useToast();
  const { t } = useTranslation();

  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setReason(null);
    setDetails('');
  };

  const submit = async () => {
    if (!reason || !targetId) return;
    setSubmitting(true);
    try {
      await submitReport({
        target,
        reason,
        details: details.trim() || undefined,
        ...(target === 'post' ? { postId: targetId } : {}),
        ...(target === 'comment' ? { commentId: targetId } : {}),
        ...(target === 'message' ? { messageId: targetId } : {}),
        ...(target === 'user' ? { userId: targetId } : {}),
        ...(target === 'group' ? { conversationId: targetId } : {}),
      });
      toast.show(t('moderation.reportSent'), 'success');
      reset();
      onClose();
    } catch (error) {
      toast.show(t(errorTranslationKey(error)), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={() => {
        reset();
        onClose();
      }}
      title={t('moderation.reportTitle', { target: t(`moderation.report${capitalize(target)}`) })}
    >
      <View style={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.lg }}>
        {REASONS.map((item) => (
          <SelectRow
            key={item.value}
            label={t(item.key)}
            selected={reason === item.value}
            onPress={() => setReason(item.value)}
          />
        ))}

        <TextField
          value={details}
          onChangeText={setDetails}
          placeholder={t('moderation.reportDetails')}
          multiline
          maxLength={1000}
          containerStyle={{ marginTop: theme.spacing.sm }}
        />

        <Button
          label={t('moderation.reportSubmit')}
          size="lg"
          fullWidth
          disabled={!reason}
          loading={submitting}
          onPress={() => void submit()}
        />
      </View>
    </BottomSheet>
  );
};

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);
