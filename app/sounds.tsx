import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AudioModule,
  RecordingPresets,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ListSkeleton } from '@/components/feedback/Skeleton';
import { SoundRow } from '@/features/university/SoundRow';
import { useHaptics } from '@/hooks/useHaptics';
import { errorTranslationKey } from '@/lib/errors';
import { backChevron } from '@/lib/rtl';
import { createSound, fetchMySounds, fetchTrendingSounds, MAX_SOUND_MS } from '@/services/sounds';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme/ThemeProvider';

/** Sound library: trending clips, your own uploads, and recording (§23). */
export default function SoundsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const haptic = useHaptics();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const profile = useSession((s) => s.profile);
  const universityId = profile?.university_id ?? '';

  const [tab, setTab] = useState<'trending' | 'mine'>('trending');
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordedMs, setRecordedMs] = useState(0);
  const [startedAt, setStartedAt] = useState(0);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  const trendingQuery = useQuery({
    queryKey: ['sounds', 'trending', universityId],
    queryFn: () => fetchTrendingSounds(universityId),
    enabled: !!universityId && tab === 'trending',
  });

  const mineQuery = useQuery({
    queryKey: ['sounds', 'mine'],
    queryFn: fetchMySounds,
    enabled: tab === 'mine',
  });

  const upload = useMutation({
    mutationFn: () => {
      if (!recordedUri) throw new Error('nothing recorded');
      return createSound({
        localUri: recordedUri,
        title,
        durationMs: recordedMs,
        universityId,
      });
    },
    onSuccess: async () => {
      toast.show(t('sounds.upload'), 'success');
      setRecorderOpen(false);
      setRecordedUri(null);
      setTitle('');
      await queryClient.invalidateQueries({ queryKey: ['sounds'] });
    },
    onError: (error) => toast.show(t(errorTranslationKey(error)), 'error'),
  });

  const startRecording = async () => {
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) return;

    await AudioModule.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setStartedAt(Date.now());
    haptic('medium');
  };

  const stopRecording = async () => {
    if (!recorderState.isRecording) return;
    await recorder.stop();
    haptic('light');
    // Clamp to the cap so an over-long take fails the friendly way rather
    // than against the database's duration constraint.
    setRecordedMs(Math.min(Date.now() - startedAt, MAX_SOUND_MS));
    setRecordedUri(recorder.uri ?? null);
  };

  const sounds = tab === 'trending' ? (trendingQuery.data ?? []) : (mineQuery.data ?? []);
  const loading = tab === 'trending' ? trendingQuery.isLoading : mineQuery.isLoading;

  const tabChip = (value: 'trending' | 'mine', label: string) => (
    <Button
      key={value}
      label={label}
      variant={tab === value ? 'primary' : 'secondary'}
      size="sm"
      onPress={() => setTab(value)}
    />
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { paddingHorizontal: theme.spacing.sm }]}>
        <IconButton icon={backChevron()} accessibilityLabel={t('a11y.back')} onPress={() => router.back()} />
        <Text variant="h2" style={{ flex: 1 }}>
          {t('sounds.title')}
        </Text>
        <IconButton
          icon="mic-circle-outline"
          size={26}
          accessibilityLabel={t('sounds.upload')}
          onPress={() => setRecorderOpen(true)}
        />
      </View>

      <View style={[styles.tabs, { paddingHorizontal: theme.spacing.lg }]}>
        {tabChip('trending', t('sounds.trending'))}
        {tabChip('mine', t('common.you'))}
      </View>

      {loading ? (
        <ListSkeleton count={3} />
      ) : (
        <FlatList
          data={sounds}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}
          renderItem={({ item }) => <SoundRow sound={item} />}
          ListEmptyComponent={
            <EmptyState
              icon="musical-notes-outline"
              title={t('sounds.title')}
              body={t('sounds.recordPrompt')}
              actionLabel={t('sounds.upload')}
              onAction={() => setRecorderOpen(true)}
            />
          }
        />
      )}

      <BottomSheet
        visible={recorderOpen}
        onClose={() => setRecorderOpen(false)}
        title={t('sounds.upload')}
      >
        <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.xxl }}>
          <Text variant="caption" color="muted">
            {t('sounds.maxDuration', { seconds: MAX_SOUND_MS / 1000 })}
          </Text>

          <TextField
            label={t('sounds.title')}
            value={title}
            onChangeText={setTitle}
            maxLength={60}
          />

          {recorderState.isRecording ? (
            <Button
              label={t('chats.recording')}
              variant="danger"
              size="lg"
              icon="stop"
              fullWidth
              onPress={() => void stopRecording()}
            />
          ) : (
            <Button
              label={recordedUri ? t('sounds.play') : t('sounds.recordPrompt')}
              variant="secondary"
              size="lg"
              icon="mic"
              fullWidth
              onPress={() => void startRecording()}
            />
          )}

          {recordedUri ? (
            <Text variant="caption" color="secondary">
              {Math.round(recordedMs / 1000)}s
            </Text>
          ) : null}

          <Button
            label={t('sounds.upload')}
            size="lg"
            fullWidth
            disabled={!recordedUri || !title.trim()}
            loading={upload.isPending}
            onPress={() => upload.mutate()}
          />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 8 },
  tabs: { flexDirection: 'row', gap: 8, paddingBottom: 12 },
});
