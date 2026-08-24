import { useState } from 'react';
import { View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { SelectRow } from '@/components/ui/SelectRow';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { OnboardingScaffold } from '@/features/onboarding/OnboardingScaffold';
import { errorTranslationKey } from '@/lib/errors';
import { uploadAvatar } from '@/services/storage';
import { completeOnboarding } from '@/services/profiles';
import { useOnboardingDraft } from '@/store/onboarding';
import { usePreferences } from '@/store/preferences';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme/ThemeProvider';

export default function IdentityStep() {
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { t, i18n } = useTranslation();

  const draft = useOnboardingDraft();
  const setProfile = useSession((s) => s.setProfile);
  const setOnboardingCompleted = usePreferences((s) => s.setOnboardingCompleted);
  const setDefaultIdentityMode = usePreferences((s) => s.setDefaultIdentityMode);
  const timezone = usePreferences((s) => s.timezone);

  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  /** Permission is requested only at the moment the user asks to pick (§43). */
  const pickAvatar = async () => {
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
      draft.setAvatarUrl(url);
    } catch (error) {
      toast.show(t(errorTranslationKey(error)), 'error');
    } finally {
      setUploading(false);
    }
  };

  const finish = async () => {
    if (!draft.universityId) return;
    setSubmitting(true);
    try {
      const profile = await completeOnboarding({
        username: draft.username,
        universityId: draft.universityId,
        avatarUrl: draft.avatarUrl,
        identityMode: draft.identityMode,
        timezone: timezone ?? 'UTC',
        locale: i18n.language,
      });

      setProfile(profile);
      setDefaultIdentityMode(draft.identityMode);
      setOnboardingCompleted(true);
      draft.reset();
      router.replace('/(tabs)');
    } catch (error) {
      toast.show(t(errorTranslationKey(error)), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OnboardingScaffold
      step={5}
      totalSteps={5}
      title={t('onboarding.identityTitle')}
      body={t('onboarding.identityBody')}
      footer={
        <Button
          label={t('onboarding.finish', { university: draft.universityName ?? '' })}
          size="lg"
          fullWidth
          loading={submitting}
          disabled={!draft.universityId}
          onPress={() => void finish()}
        />
      }
    >
      <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
        <Avatar
          uri={draft.avatarUrl}
          name={draft.username}
          size={96}
          anonymous={draft.identityMode === 'anonymous'}
        />
        <Button
          label={t('onboarding.avatarTitle')}
          variant="secondary"
          size="sm"
          icon="camera"
          loading={uploading}
          onPress={() => void pickAvatar()}
        />
        <Text variant="caption" color="muted" align="center">
          {t('onboarding.avatarBody')}
        </Text>
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <SelectRow
          label={t('onboarding.identityPublic')}
          description={t('onboarding.identityPublicBody')}
          selected={draft.identityMode === 'public'}
          onPress={() => draft.setIdentityMode('public')}
        />
        <SelectRow
          label={t('onboarding.identityAnonymous')}
          description={t('onboarding.identityAnonymousBody')}
          selected={draft.identityMode === 'anonymous'}
          onPress={() => draft.setIdentityMode('anonymous')}
        />
      </View>
    </OnboardingScaffold>
  );
}
