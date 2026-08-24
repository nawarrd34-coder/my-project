import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  AudioModule,
  RecordingPresets,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useTranslation } from 'react-i18next';

import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';
import { useHaptics } from '@/hooks/useHaptics';
import { errorTranslationKey } from '@/lib/errors';
import { uploadMessageMedia } from '@/services/storage';
import { useTheme } from '@/theme/ThemeProvider';

export interface ChatInputProps {
  onSendText: (body: string) => void;
  onSendImage: (storagePath: string) => void;
  onSendVoice: (storagePath: string, durationMs: number) => void;
  onTyping: () => void;
  disabled?: boolean;
  disabledReason?: string;
}

const MAX_VOICE_MS = 120_000;

/** Composer for a chat: text, photo, and hold-to-record voice notes (§12). */
export const ChatInput = ({
  onSendText,
  onSendImage,
  onSendVoice,
  onTyping,
  disabled = false,
  disabledReason,
}: ChatInputProps) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const haptic = useHaptics();
  const { t } = useTranslation();

  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const startedAt = useRef<number>(0);

  // Stop an over-long recording rather than letting it fail the DB's duration
  // constraint after the upload.
  useEffect(() => {
    if (!recorderState.isRecording) return;
    const timer = setTimeout(() => void stopRecording(), MAX_VOICE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorderState.isRecording]);

  const sendText = () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    onSendText(body);
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    setBusy(true);
    try {
      onSendImage(await uploadMessageMedia(result.assets[0].uri));
    } catch (error) {
      toast.show(t(errorTranslationKey(error)), 'error');
    } finally {
      setBusy(false);
    }
  };

  const startRecording = async () => {
    // Microphone permission is requested at the moment of first use (§43).
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) return;

    await AudioModule.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    startedAt.current = Date.now();
    haptic('medium');
  };

  const stopRecording = async () => {
    if (!recorderState.isRecording) return;
    await recorder.stop();
    haptic('light');

    const durationMs = Date.now() - startedAt.current;
    const uri = recorder.uri;
    // Below half a second is almost always an accidental tap.
    if (!uri || durationMs < 500) return;

    setBusy(true);
    try {
      onSendVoice(await uploadMessageMedia(uri), Math.min(durationMs, MAX_VOICE_MS));
    } catch (error) {
      toast.show(t(errorTranslationKey(error)), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (disabled) {
    return (
      <View
        style={[
          styles.disabled,
          {
            padding: theme.spacing.lg,
            paddingBottom: insets.bottom + theme.spacing.lg,
            backgroundColor: theme.colors.surfaceSunken,
          },
        ]}
      >
        <Text variant="caption" color="secondary" align="center">
          {disabledReason ?? t('errors.unauthorized')}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: theme.spacing.sm,
        padding: theme.spacing.md,
        paddingBottom: insets.bottom + theme.spacing.md,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.divider,
        backgroundColor: theme.colors.backgroundElevated,
      }}
    >
      {recorderState.isRecording ? (
        <View style={[styles.recording, { gap: theme.spacing.sm }]}>
          <View style={[styles.dot, { backgroundColor: theme.colors.error }]} />
          <Text variant="callout" color="secondary" style={{ flex: 1 }}>
            {t('chats.recording')}
          </Text>
          <IconButton
            icon="send"
            background="accent"
            accessibilityLabel={t('a11y.sendMessage')}
            onPress={() => void stopRecording()}
          />
        </View>
      ) : (
        <>
          <IconButton
            icon="image-outline"
            accessibilityLabel={t('chats.photo')}
            disabled={busy}
            onPress={() => void pickImage()}
          />
          <TextField
            value={draft}
            onChangeText={(value) => {
              setDraft(value);
              onTyping();
            }}
            placeholder={t('chats.messagePlaceholder')}
            multiline
            maxLength={4000}
            containerStyle={{ flex: 1 }}
          />
          {draft.trim() ? (
            <IconButton
              icon="send"
              background="accent"
              accessibilityLabel={t('a11y.sendMessage')}
              disabled={busy}
              onPress={sendText}
            />
          ) : (
            <IconButton
              icon="mic"
              accessibilityLabel={t('a11y.recordVoice')}
              disabled={busy}
              onPress={() => void startRecording()}
            />
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  disabled: { alignItems: 'center' },
  recording: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
