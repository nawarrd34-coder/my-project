import { Pressable, StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { Skeleton } from '@/components/feedback/Skeleton';
import { useHaptics } from '@/hooks/useHaptics';
import { errorTranslationKey } from '@/lib/errors';
import { fetchPollOptions, voteOnPoll } from '@/services/posts';
import { useTheme } from '@/theme/ThemeProvider';

/** Poll rendering with live result bars (§10). */
export const PollCard = ({ postId }: { postId: string }) => {
  const theme = useTheme();
  const toast = useToast();
  const haptic = useHaptics();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ['poll', postId],
    queryFn: () => fetchPollOptions(postId),
  });

  const mutation = useMutation({
    mutationFn: (optionId: string) => voteOnPoll(postId, optionId),
    onSuccess: async () => {
      haptic('success');
      await queryClient.invalidateQueries({ queryKey: ['poll', postId] });
    },
    // A duplicate vote is rejected by the primary key on poll_votes, which
    // surfaces here as a clear message rather than a silent no-op.
    onError: (error) => toast.show(t(errorTranslationKey(error)), 'error'),
  });

  if (isLoading) return <Skeleton height={140} radius={theme.radius.lg} />;

  const options = data ?? [];
  const total = options.reduce((sum, option) => sum + option.vote_count, 0);

  return (
    <Card>
      <View style={{ gap: theme.spacing.sm }}>
        {options.map((option) => {
          const share = total > 0 ? Math.round((option.vote_count / total) * 100) : 0;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityLabel={`${option.label}, ${share}%`}
              disabled={mutation.isPending}
              onPress={() => mutation.mutate(option.id)}
              style={[
                styles.option,
                {
                  borderRadius: theme.radius.sm,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surfaceSunken,
                },
              ]}
            >
              <View
                style={[
                  styles.fill,
                  { width: `${share}%`, backgroundColor: theme.colors.accentSubtle },
                ]}
              />
              <View style={[styles.optionContent, { padding: theme.spacing.md }]}>
                <Text variant="callout" style={{ flex: 1 }}>
                  {option.label}
                </Text>
                <Text variant="captionStrong" color="secondary">
                  {share}%
                </Text>
              </View>
            </Pressable>
          );
        })}
        <Text variant="caption" color="muted">
          {t('post.pollVotes', { count: total })}
        </Text>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  option: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  // Grows from the reading-start edge, so the bar fills right-to-left
  // in Arabic without any conditional.
  fill: { position: 'absolute', top: 0, bottom: 0, insetInlineStart: 0 },
  optionContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
