import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { signedSoundUrl } from '@/services/sounds';
import type { SoundRow as SoundRecord } from '@/services/types';

export interface SoundRowProps {
  sound: SoundRecord;
  onUse?: () => void;
}

/** One entry in the sounds list: preview, play/pause, and use (§23). */
export const SoundRow = ({ sound, onUse }: SoundRowProps) => {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);

  // The URL is fetched lazily on mount rather than for the whole list at once,
  // so scrolling past a sound does not mint a signed URL for it.
  useEffect(() => {
    let active = true;
    void signedSoundUrl(sound.storage_path).then((signed) => {
      if (active) setUrl(signed);
    });
    return () => {
      active = false;
    };
  }, [sound.storage_path]);

  const player = useAudioPlayer(url ? { uri: url } : null);
  const status = useAudioPlayerStatus(player);

  return (
    <Card elevation="none">
      <View style={styles.row}>
        <IconButton
          icon={status.playing ? 'pause-circle' : 'play-circle'}
          size={32}
          accessibilityLabel={status.playing ? t('a11y.pauseSound') : t('a11y.playSound')}
          disabled={!url}
          onPress={() => {
            if (status.playing) {
              player.pause();
            } else {
              if (status.didJustFinish) player.seekTo(0);
              player.play();
            }
          }}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {sound.title}
          </Text>
          <Text variant="caption" color="muted">
            {Math.round(sound.duration_ms / 1000)}s · {t('sounds.uses', { count: sound.use_count })}
            {!sound.is_approved ? ` · ${t('moderation.contentHidden')}` : ''}
          </Text>
        </View>
        {onUse && sound.is_approved ? (
          <IconButton
            icon="add-circle-outline"
            accessibilityLabel={t('sounds.use')}
            onPress={onUse}
          />
        ) : null}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
