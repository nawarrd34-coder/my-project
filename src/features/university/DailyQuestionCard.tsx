import { Pressable, StyleSheet, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { useHaptics } from '@/hooks/useHaptics';
import { errorTranslationKey } from '@/lib/errors';
import { answerDailyQuestion } from '@/services/universities';
import type { CampusPulse } from '@/services/types';
import { useTheme } from '@/theme/ThemeProvider';

export interface DailyQuestionCardProps {
  question: NonNullable<CampusPulse['daily_question']>;
}

/** Question of the day with live results (§21). */
export const DailyQuestionCard = ({ question }: DailyQuestionCardProps) => {
  const theme = useTheme();
  const toast = useToast();
  const haptic = useHaptics();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();

  const isArabic = i18n.language === 'ar';
  const closed = new Date(question.closes_at) <= new Date();
  // Results are revealed after voting, so early voters do not anchor later ones.
  const showResults = question.answered || closed;

  const mutation = useMutation({
    mutationFn: (optionId: string) => answerDailyQuestion(question.id, optionId),
    onSuccess: async () => {
      haptic('success');
      await queryClient.invalidateQueries({ queryKey: ['pulse'] });
    },
    onError: (error) => toast.show(t(errorTranslationKey(error)), 'error'),
  });

  const total = question.options.reduce((sum, option) => sum + option.vote_count, 0);

  return (
    <Card>
      <View style={{ gap: theme.spacing.md }}>
        <View style={{ gap: 2 }}>
          <Text variant="micro" color="accent">
            {t('dailyQuestion.title').toUpperCase()}
          </Text>
          <Text variant="h3">{isArabic ? question.question_ar : question.question_en}</Text>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          {question.options.map((option) => {
            const share = total > 0 ? Math.round((option.vote_count / total) * 100) : 0;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityLabel={
                  showResults
                    ? `${isArabic ? option.label_ar : option.label_en}, ${share}%`
                    : (isArabic ? option.label_ar : option.label_en)
                }
                disabled={showResults || mutation.isPending}
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
                {showResults ? (
                  <View
                    style={[
                      styles.fill,
                      { width: `${share}%`, backgroundColor: theme.colors.accentSubtle },
                    ]}
                  />
                ) : null}
                <View style={[styles.content, { padding: theme.spacing.md }]}>
                  <Text variant="callout" style={{ flex: 1 }}>
                    {isArabic ? option.label_ar : option.label_en}
                  </Text>
                  {showResults ? (
                    <Text variant="captionStrong" color="secondary">
                      {share}%
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text variant="caption" color="muted">
          {closed
            ? t('dailyQuestion.closed')
            : t('dailyQuestion.totalVotes', { count: question.vote_count })}
        </Text>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  option: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  fill: { position: 'absolute', top: 0, bottom: 0, insetInlineStart: 0 },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
