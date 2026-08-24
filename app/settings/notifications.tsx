import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { requestPushPermission } from '@/hooks/usePushNotifications';

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

  /**
   * OS-level permission status. The per-kind switches below are meaningless
   * while the system permission is off, so the state is surfaced rather than
   * letting the user toggle rows that cannot fire (§36).
   */
  const [permission, setPermission] = useState<'granted' | 'denied' | 'undetermined'>(
    'undetermined',
  );

  useEffect(() => {
    void Notifications.getPermissionsAsync().then(({ status, canAskAgain }) => {
      setPermission(status === 'granted' ? 'granted' : canAskAgain ? 'undetermined' : 'denied');
    });
  }, []);

  const enablePush = async () => {
    const granted = await requestPushPermission();
    setPermission(granted ? 'granted' : 'denied');
    if (!granted) toast.show(t('notifications.permissionBlocked'), 'error');
  };

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
      {permission !== 'granted' ? (
        <Card style={{ marginHorizontal: 16 }}>
          <View style={{ gap: 12 }}>
            <Text variant="bodyStrong">{t('notifications.permissionTitle')}</Text>
            <Text variant="callout" color="secondary">
              {permission === 'denied'
                ? t('notifications.permissionBlocked')
                : t('notifications.permissionBody')}
            </Text>
            <Button
              label={
                permission === 'denied'
                  ? t('notifications.openSettings')
                  : t('notifications.permissionAllow')
              }
              fullWidth
              onPress={() => {
                // Once the OS has recorded a denial, asking again is a no-op;
                // the only route back is the system settings app.
                if (permission === 'denied') void Linking.openSettings();
                else void enablePush();
              }}
            />
          </View>
        </Card>
      ) : null}

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
