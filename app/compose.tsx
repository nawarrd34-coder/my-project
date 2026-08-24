import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { SelectRow } from '@/components/ui/SelectRow';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';
import { errorTranslationKey } from '@/lib/errors';
import { queryKeys } from '@/lib/queryClient';
import { createPost } from '@/services/posts';
import { uploadPostMedia, publicUrlFor, BUCKETS } from '@/services/storage';
import { fetchChannels } from '@/services/universities';
import type { IdentityMode, PostKind } from '@/services/types';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme/ThemeProvider';

const MAX_BODY = 2000;
const MAX_POLL_OPTIONS = 6;

export default function ComposeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();

  const profile = useSession((s) => s.profile);
  const universityId = profile?.university_id ?? '';

  const [body, setBody] = useState('');
  const [kind, setKind] = useState<PostKind>('text');
  const [channelId, setChannelId] = useState<string | null>(null);
  const [identityMode, setIdentityMode] = useState<IdentityMode>(
    profile?.default_identity ?? 'public',
  );
  const [mediaPaths, setMediaPaths] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);

  const { data: channels } = useQuery({
    queryKey: queryKeys.channels(universityId),
    queryFn: () => fetchChannels(universityId),
    enabled: !!universityId,
  });

  const mutation = useMutation({
    mutationFn: () =>
      createPost({
        body: body.trim(),
        kind,
        channelId,
        identityMode,
        media: mediaPaths.map((path) => ({ kind: 'image' as const, storage_path: path })),
        pollOptions:
          kind === 'poll' ? pollOptions.map((o) => o.trim()).filter(Boolean) : undefined,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['feed'] });
      await queryClient.invalidateQueries({ queryKey: ['pulse'] });
      router.back();
    },
    onError: (error) => toast.show(t(errorTranslationKey(error)), 'error'),
  });

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 4,
    });
    if (result.canceled) return;

    setUploading(true);
    try {
      const paths = await Promise.all(result.assets.map((asset) => uploadPostMedia(asset.uri)));
      setMediaPaths((current) => [...current, ...paths].slice(0, 4));
      setKind('image');
    } catch (error) {
      toast.show(t(errorTranslationKey(error)), 'error');
    } finally {
      setUploading(false);
    }
  };

  const validPollOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
  const canPost =
    !uploading &&
    (kind === 'poll'
      ? body.trim().length > 0 && validPollOptions.length >= 2
      : kind === 'image'
        ? mediaPaths.length > 0 || body.trim().length > 0
        : body.trim().length > 0);

  const isArabic = i18n.language === 'ar';

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + theme.spacing.sm,
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: theme.spacing.sm,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.colors.divider,
          },
        ]}
      >
        <IconButton icon="close" accessibilityLabel={t('common.cancel')} onPress={() => router.back()} />
        <Text variant="h3" style={{ flex: 1 }}>
          {t('post.create')}
        </Text>
        <Button
          label={t('post.publish')}
          size="sm"
          disabled={!canPost}
          loading={mutation.isPending}
          onPress={() => mutation.mutate()}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <TextField
          value={body}
          onChangeText={setBody}
          placeholder={
            kind === 'poll'
              ? t('post.pollQuestion')
              : t('post.placeholder', { university: profile?.username ?? '' })
          }
          multiline
          maxLength={MAX_BODY}
          autoFocus
          style={{ minHeight: 120, textAlignVertical: 'top' }}
          helperText={`${body.length} / ${MAX_BODY}`}
        />

        {mediaPaths.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {mediaPaths.map((path) => (
              <View key={path}>
                <Image
                  source={{ uri: publicUrlFor(BUCKETS.posts, path) }}
                  style={{ width: 100, height: 100, borderRadius: theme.radius.sm }}
                  contentFit="cover"
                />
                <IconButton
                  icon="close-circle"
                  size={20}
                  accessibilityLabel={t('common.remove')}
                  onPress={() => setMediaPaths((c) => c.filter((p) => p !== path))}
                  style={styles.removeMedia}
                />
              </View>
            ))}
          </ScrollView>
        ) : null}

        {kind === 'poll' ? (
          <View style={{ gap: theme.spacing.sm }}>
            {pollOptions.map((option, index) => (
              <TextField
                key={index}
                value={option}
                onChangeText={(value) =>
                  setPollOptions((current) => current.map((o, i) => (i === index ? value : o)))
                }
                placeholder={`${index + 1}`}
                maxLength={80}
                trailing={
                  pollOptions.length > 2 ? (
                    <IconButton
                      icon="close"
                      size={16}
                      accessibilityLabel={t('common.remove')}
                      onPress={() =>
                        setPollOptions((current) => current.filter((_, i) => i !== index))
                      }
                    />
                  ) : null
                }
              />
            ))}
            {pollOptions.length < MAX_POLL_OPTIONS ? (
              <Button
                label={t('post.pollAddOption')}
                variant="ghost"
                size="sm"
                icon="add"
                onPress={() => setPollOptions((current) => [...current, ''])}
              />
            ) : null}
          </View>
        ) : null}

        <View style={styles.typeRow}>
          <Button
            label={t('post.typeImage')}
            variant={kind === 'image' ? 'primary' : 'secondary'}
            size="sm"
            icon="image-outline"
            loading={uploading}
            onPress={() => void pickImage()}
          />
          <Button
            label={t('post.typePoll')}
            variant={kind === 'poll' ? 'primary' : 'secondary'}
            size="sm"
            icon="bar-chart-outline"
            onPress={() => setKind(kind === 'poll' ? 'text' : 'poll')}
          />
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="captionStrong" color="secondary">
            {t('post.channel')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {(channels ?? []).map((channel) => (
              <Button
                key={channel.id}
                label={isArabic ? channel.name_ar : channel.name_en}
                variant={channelId === channel.id ? 'primary' : 'secondary'}
                size="sm"
                onPress={() => setChannelId(channelId === channel.id ? null : channel.id)}
              />
            ))}
          </ScrollView>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="captionStrong" color="secondary">
            {t('post.postAs')}
          </Text>
          <SelectRow
            label={`@${profile?.username ?? ''}`}
            selected={identityMode === 'public'}
            onPress={() => setIdentityMode('public')}
          />
          <SelectRow
            label={t('onboarding.identityAnonymous')}
            description={t('onboarding.identityAnonymousBody')}
            selected={identityMode === 'anonymous'}
            onPress={() => setIdentityMode('anonymous')}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  typeRow: { flexDirection: 'row', gap: 8 },
  removeMedia: { position: 'absolute', top: -6, insetInlineEnd: -6 },
});
