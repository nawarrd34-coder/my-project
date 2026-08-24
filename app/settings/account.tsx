import { useState } from 'react';
import { View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';
import { SettingsScaffold } from '@/features/profile/SettingsScaffold';
import { errorTranslationKey } from '@/lib/errors';
import { updateMyProfile } from '@/services/profiles';
import { uploadAvatar } from '@/services/storage';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme/ThemeProvider';

export default function AccountSettings() {
  const theme = useTheme();
  const toast = useToast();
  const { t } = useTranslation();

  const profile = useSession((s) => s.profile);
  const setProfile = useSession((s) => s.setProfile);

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [uploading, setUploading] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      updateMyProfile({
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
      }),
    onSuccess: (updated) => {
      setProfile(updated);
      toast.show(t('common.save'), 'success');
    },
    onError: (error) => toast.show(t(errorTranslationKey(error)), 'error'),
  });

  const changeAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    try {
      const url = await uploadAvatar(result.assets[0].uri);
      const updated = await updateMyProfile({ avatar_url: url });
      setProfile(updated);
    } catch (error) {
      toast.show(t(errorTranslationKey(error)), 'error');
    } finally {
      setUploading(false);
    }
  };

  if (!profile) return null;

  return (
    <SettingsScaffold title={t('settings.account')}>
      <View style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.lg }}>
        <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
          <Avatar uri={profile.avatar_url} name={profile.username} size={96} />
          <Button
            label={t('profile.changeAvatar')}
            variant="secondary"
            size="sm"
            icon="camera"
            loading={uploading}
            onPress={() => void changeAvatar()}
          />
        </View>

        {/* Username is immutable after signup: changing it would break mentions
            and let a user shed their history. Enforced by a database trigger,
            shown read-only here. */}
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="captionStrong" color="secondary">
            {t('onboarding.usernameTitle')}
          </Text>
          <Text variant="body" color="muted">
            @{profile.username}
          </Text>
        </View>

        <TextField
          label={t('profile.displayName')}
          value={displayName}
          onChangeText={setDisplayName}
          maxLength={40}
        />

        <TextField
          label={t('profile.bio')}
          value={bio}
          onChangeText={setBio}
          placeholder={t('profile.bioPlaceholder')}
          multiline
          maxLength={200}
          helperText={`${bio.length} / 200`}
        />

        <Button
          label={t('common.save')}
          size="lg"
          fullWidth
          loading={mutation.isPending}
          onPress={() => mutation.mutate()}
        />
      </View>
    </SettingsScaffold>
  );
}
