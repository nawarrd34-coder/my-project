import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/Text';
import { VoiceMessage } from './VoiceMessage';
import { formatTime } from '@/lib/datetime';
import { BUCKETS, publicUrlFor } from '@/services/storage';
import type { Message } from '@/services/types';
import { useTheme } from '@/theme/ThemeProvider';

export interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
  /** True when the recipient's read watermark is past this message. */
  isRead: boolean;
  /** Local-only flag while an optimistic message is in flight. */
  pending?: boolean;
  failed?: boolean;
  onLongPress?: () => void;
  onRetry?: () => void;
}

/**
 * A single chat bubble.
 *
 * Alignment uses `flex-start` / `flex-end`, which follow the layout direction,
 * so in Arabic the sender's bubbles sit on the left without a conditional.
 */
export const MessageBubble = memo(function MessageBubble({
  message,
  isMine,
  isRead,
  pending = false,
  failed = false,
  onLongPress,
  onRetry,
}: MessageBubbleProps) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();

  const bubbleColor = isMine ? theme.colors.accent : theme.colors.surfaceElevated;
  const textColor = isMine ? theme.colors.textOnAccent : theme.colors.textPrimary;

  return (
    <Pressable
      onLongPress={onLongPress}
      onPress={failed ? onRetry : undefined}
      accessibilityRole="text"
      accessibilityLabel={message.body ?? t(`chats.${message.kind}`)}
      style={[styles.row, { justifyContent: isMine ? 'flex-end' : 'flex-start' }]}
    >
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: bubbleColor,
            borderRadius: theme.radius.lg,
            // Flatten the corner nearest the speaker, the usual chat cue.
            borderStartStartRadius: isMine ? theme.radius.lg : theme.radius.xs,
            borderEndEndRadius: isMine ? theme.radius.xs : theme.radius.lg,
            padding: theme.spacing.md,
            opacity: pending ? 0.6 : 1,
          },
        ]}
      >
        {message.kind === 'image' && message.storage_path ? (
          <Image
            source={{ uri: publicUrlFor(BUCKETS.messages, message.storage_path) }}
            style={styles.media}
            contentFit="cover"
            transition={120}
          />
        ) : null}

        {message.kind === 'voice' && message.storage_path ? (
          <VoiceMessage
            storagePath={message.storage_path}
            durationMs={message.duration_ms ?? 0}
            tint={textColor}
          />
        ) : null}

        {message.body ? (
          <Text variant="body" style={{ color: textColor }}>
            {message.body}
          </Text>
        ) : null}

        <View style={styles.meta}>
          {/* The streak flame marks the message that actually counted for the
              day, which the server decided (§15). */}
          {message.counted_for_streak ? <Text variant="micro">🔥</Text> : null}
          <Text variant="micro" style={{ color: textColor, opacity: 0.7 }}>
            {failed ? t('chats.tapToRetry') : formatTime(message.created_at, i18n.language)}
          </Text>
          {isMine && !failed ? (
            <Ionicons
              name={pending ? 'time-outline' : isRead ? 'checkmark-done' : 'checkmark'}
              size={13}
              color={textColor}
              style={{ opacity: 0.8 }}
            />
          ) : null}
          {failed ? <Ionicons name="alert-circle" size={13} color={theme.colors.error} /> : null}
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 2 },
  bubble: { maxWidth: '80%', gap: 6 },
  media: { width: 220, height: 220, borderRadius: 10 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
});
