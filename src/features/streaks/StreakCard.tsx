import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StreakBadge } from '@/components/ui/StreakBadge';
import { Text } from '@/components/ui/Text';
import { useCountdown } from './useCountdown';
import { canRestore } from './format';
import type { StreakWithPartner } from '@/services/types';
import { useTheme } from '@/theme/ThemeProvider';

export interface StreakCardProps {
  streak: StreakWithPartner;
  variant: 'active' | 'expiring' | 'new' | 'past';
  onRestore?: () => void;
  restoring?: boolean;
}

/** One row on the Streaks screen (§17). */
export const StreakCard = ({ streak, variant, onRestore, restoring = false }: StreakCardProps) => {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();

  const countdown = useCountdown(variant === 'expiring' ? streak.expiresAt : null);
  const name = streak.partner.displayName ?? `@${streak.partner.username}`;
  const restorable = variant === 'past' && canRestore(streak);

  return (
    <Card
      onPress={
        streak.conversationId ? () => router.push(`/chat/${streak.conversationId}`) : undefined
      }
      accessibilityLabel={name}
      style={
        variant === 'expiring'
          ? { borderColor: theme.colors.streakExpiring, borderWidth: 1.5 }
          : undefined
      }
    >
      <View style={{ gap: theme.spacing.md }}>
        <View style={styles.row}>
          <Avatar uri={streak.partner.avatarUrl} name={streak.partner.username} size={48} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {name}
            </Text>
            {variant === 'past' ? (
              <Text variant="caption" color="muted">
                {t('streaks.expiredTitle', { count: streak.longestLength })}
              </Text>
            ) : variant === 'new' ? (
              <Text variant="caption" color="secondary">
                {t('streaks.pendingHint')}
              </Text>
            ) : streak.myTurnDone ? (
              <Text variant="caption" color="success">
                ✓ {t('common.today')}
              </Text>
            ) : (
              <Text variant="caption" color="secondary">
                {t('streaks.keepAlive')}
              </Text>
            )}
          </View>
          <StreakBadge
            count={streak.currentLength}
            status={streak.status}
            size="md"
            animate={variant === 'active'}
          />
        </View>

        {variant === 'expiring' && !countdown.expired ? (
          <View
            style={[
              styles.countdown,
              {
                backgroundColor: theme.colors.warningSubtle,
                borderRadius: theme.radius.sm,
                padding: theme.spacing.md,
              },
            ]}
          >
            <Text variant="caption" color="secondary" style={{ flex: 1 }}>
              {t('streaks.keepAlive')}
            </Text>
            {/* Monospaced digits so the timer does not shift as it ticks. */}
            <Text variant="h3" style={{ fontVariant: ['tabular-nums'] }}>
              {countdown.formatted}
            </Text>
          </View>
        ) : null}

        {restorable && onRestore ? (
          <Button
            label={t('streaks.restore')}
            variant="secondary"
            size="sm"
            icon="refresh"
            loading={restoring}
            fullWidth
            onPress={onRestore}
          />
        ) : null}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  countdown: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
