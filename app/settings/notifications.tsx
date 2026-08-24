import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { SettingRow } from '@/components/ui/SettingRow';
import { SettingSection } from '@/components/ui/SettingSection';
import { useToast } from '@/components/ui/Toast';
import { Skeleton } from '@/components/feedback/Skeleton';
import { SettingsScaffold } from '@/features/profile/SettingsScaffold';
import { errorTranslationKey } from '@/lib/errors';
import { queryKeys } from '@/lib/queryClient';
import {
  fetchNotificationSettings,
  updateNotificationSettings,
} from '@/services/notifications';
import type { NotificationSettings } from '@/services/types';

type SettingKey = keyof Omit<NotificationSettings, 'user_id' | 'updated_at'>;

export default function NotificationSettingsScreen() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.notificationSettings,
    queryFn: fetchNotificationSettings,
  });

  const mutation = useMutation({
    mutationFn: (patch: Partial<NotificationSettings>) => updateNotificationSettings(patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notificationSettings }),
    onError: (error) => toast.show(t(errorTranslationKey(error)), 'error'),
  });

  if (isLoading || !data) {
    return (
      <SettingsScaffold title={t('settings.notifications')}>
        <Skeleton height={300} radius={16} style={{ marginHorizontal: 16 }} />
      </SettingsScaffold>
    );
  }

  const toggle = (key: SettingKey, label: string) => (
    <SettingRow
      kind="toggle"
      label={label}
      value={!!data[key]}
      onValueChange={(value) => mutation.mutate({ [key]: value })}
    />
  );

  return (
    <SettingsScaffold title={t('settings.notifications')}>
      <SettingSection>
        {toggle('streaks', t('settings.notifyStreaks'))}
        {toggle('messages', t('settings.notifyMessages'))}
        {toggle('reactions', t('settings.notifyReactions'))}
        {toggle('comments', t('settings.notifyComments'))}
        {toggle('daily_question', t('settings.notifyDailyQuestion'))}
        {toggle('university_activity', t('settings.notifyUniversity'))}
      </SettingSection>
    </SettingsScaffold>
  );
}
