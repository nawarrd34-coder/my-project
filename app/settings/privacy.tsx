import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { SettingRow } from '@/components/ui/SettingRow';
import { SettingSection } from '@/components/ui/SettingSection';
import { useToast } from '@/components/ui/Toast';
import { SettingsScaffold } from '@/features/profile/SettingsScaffold';
import { errorTranslationKey } from '@/lib/errors';
import { queryKeys } from '@/lib/queryClient';
import { updateMyProfile, type ProfilePatch } from '@/services/profiles';
import { useSession } from '@/store/session';

export default function PrivacySettings() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const profile = useSession((s) => s.profile);
  const setProfile = useSession((s) => s.setProfile);

  const mutation = useMutation({
    mutationFn: (patch: ProfilePatch) => updateMyProfile(patch),
    onSuccess: async (updated) => {
      // Keep the session store authoritative so other screens reflect the
      // change immediately rather than after their next fetch.
      setProfile(updated);
      await queryClient.invalidateQueries({ queryKey: queryKeys.myProfile });
    },
    onError: (error) => toast.show(t(errorTranslationKey(error)), 'error'),
  });

  if (!profile) return null;

  const toggle = (key: keyof ProfilePatch, label: string, description?: string) => (
    <SettingRow
      kind="toggle"
      label={label}
      description={description}
      value={!!profile[key as keyof typeof profile]}
      onValueChange={(value) => mutation.mutate({ [key]: value } as ProfilePatch)}
    />
  );

  return (
    <SettingsScaffold title={t('settings.privacy')}>
      <SettingSection title={t('settings.privacy')}>
        {toggle('show_username', t('settings.showUsername'))}
        {toggle('allow_direct_messages', t('settings.allowMessages'))}
        {toggle('allow_group_invites', t('settings.allowGroupInvites'))}
        {toggle('show_online_status', t('settings.showOnlineStatus'))}
        {toggle('read_receipts', t('settings.readReceipts'))}
        {toggle('hide_from_leaderboard', t('settings.hideFromLeaderboard'))}
      </SettingSection>

      <SettingSection title={t('settings.anonymousMode')}>
        <SettingRow
          kind="toggle"
          label={t('settings.anonymousMode')}
          description={t('settings.anonymousModeBody')}
          value={profile.default_identity === 'anonymous'}
          onValueChange={(value) =>
            mutation.mutate({ default_identity: value ? 'anonymous' : 'public' })
          }
        />
      </SettingSection>
    </SettingsScaffold>
  );
}
