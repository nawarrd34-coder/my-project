import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useTranslation } from 'react-i18next';

import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { supabase } from '@/lib/supabase';
import { BUCKETS } from '@/services/storage';

export interface VoiceMessageProps {
  storagePath: string;
  durationMs: number;
  tint: string;
}

/**
 * Voice note playback (§12).
 *
 * Message media lives in a private bucket, so the URL is signed on demand
 * rather than being publicly guessable.
 */
export const VoiceMessage = ({ storagePath, durationMs, tint }: VoiceMessageProps) => {
  const { t } = useTranslation();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void supabase.storage
      .from(BUCKETS.messages)
      .createSignedUrl(storagePath, 3600)
      .then(({ data }) => {
        if (active && data?.signedUrl) setSignedUrl(data.signedUrl);
      });
    return () => {
      active = false;
    };
  }, [storagePath]);

  const player = useAudioPlayer(signedUrl ? { uri: signedUrl } : null);
  const status = useAudioPlayerStatus(player);

  const seconds = Math.max(Math.round(durationMs / 1000), 1);
  const progress = status.duration > 0 ? status.currentTime / status.duration : 0;

  return (
    <View style={styles.row}>
      <IconButton
        icon={status.playing ? 'pause' : 'play'}
        size={18}
        color={tint}
        accessibilityLabel={status.playing ? t('a11y.pauseSound') : t('a11y.playSound')}
        disabled={!signedUrl}
        onPress={() => {
          if (status.playing) {
            player.pause();
          } else {
            // Replaying from the end should start over, not sit at the end.
            if (status.didJustFinish || status.currentTime >= status.duration) player.seekTo(0);
            player.play();
          }
        }}
      />
      <View style={[styles.track, { backgroundColor: `${tint}33` }]}>
        <View
          style={[styles.progress, { width: `${Math.min(progress * 100, 100)}%`, backgroundColor: tint }]}
        />
      </View>
      <Text variant="micro" style={{ color: tint, opacity: 0.8 }}>
        {seconds}s
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 160 },
  track: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden' },
  progress: { height: 3, borderRadius: 2 },
});
