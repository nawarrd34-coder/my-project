import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';
import { SettingsScaffold } from '@/features/profile/SettingsScaffold';
import { errorTranslationKey } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme/ThemeProvider';

const MAX_OPTIONS = 6;

/**
 * Create the question of the day (§30).
 *
 * Both languages are required: a question that only exists in one would render
 * as a blank card for half the campus (§4).
 */
export default function AdminDailyQuestionScreen() {
  const theme = useTheme();
  const toast = useToast();
  const { t } = useTranslation();

  const profile = useSession((s) => s.profile);
  const [questionEn, setQuestionEn] = useState('');
  const [questionAr, setQuestionAr] = useState('');
  const [options, setOptions] = useState<{ en: string; ar: string }[]>([
    { en: '', ar: '' },
    { en: '', ar: '' },
  ]);
  const [saving, setSaving] = useState(false);

  const validOptions = options.filter((o) => o.en.trim() && o.ar.trim());
  const canSave = questionEn.trim() && questionAr.trim() && validOptions.length >= 2;

  const save = async () => {
    if (!profile?.university_id || !canSave) return;
    setSaving(true);
    try {
      const today = new Date();
      const localDay = today.toISOString().slice(0, 10);
      // Close at the end of the university's day; the RLS policy also refuses
      // votes after `closes_at`.
      const closesAt = new Date(today);
      closesAt.setHours(23, 59, 59, 0);

      const { data: question, error } = await supabase
        .from('daily_questions')
        .insert({
          university_id: profile.university_id,
          local_day: localDay,
          question_en: questionEn.trim(),
          question_ar: questionAr.trim(),
          created_by: profile.id,
          closes_at: closesAt.toISOString(),
        })
        .select()
        .single();
      if (error) throw error;

      const { error: optionsError } = await supabase.from('daily_question_options').insert(
        validOptions.map((option, index) => ({
          question_id: question.id,
          label_en: option.en.trim(),
          label_ar: option.ar.trim(),
          position: index,
        })),
      );
      if (optionsError) throw optionsError;

      toast.show(t('admin.createDailyQuestion'), 'success');
      setQuestionEn('');
      setQuestionAr('');
      setOptions([{ en: '', ar: '' }, { en: '', ar: '' }]);
    } catch (error) {
      toast.show(t(errorTranslationKey(error)), 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateOption = (index: number, key: 'en' | 'ar', value: string) =>
    setOptions((current) => current.map((o, i) => (i === index ? { ...o, [key]: value } : o)));

  return (
    <SettingsScaffold title={t('admin.dailyQuestion')}>
      <View style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.lg }}>
        <TextField label="English" value={questionEn} onChangeText={setQuestionEn} maxLength={160} />
        <TextField label="العربية" value={questionAr} onChangeText={setQuestionAr} maxLength={160} />

        {options.map((option, index) => (
          <View key={index} style={{ gap: theme.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text variant="captionStrong" color="secondary" style={{ flex: 1 }}>
                {index + 1}
              </Text>
              {options.length > 2 ? (
                <IconButton
                  icon="close"
                  size={16}
                  accessibilityLabel={t('common.remove')}
                  onPress={() => setOptions((c) => c.filter((_, i) => i !== index))}
                />
              ) : null}
            </View>
            <TextField
              value={option.en}
              onChangeText={(value) => updateOption(index, 'en', value)}
              placeholder="English"
              maxLength={80}
            />
            <TextField
              value={option.ar}
              onChangeText={(value) => updateOption(index, 'ar', value)}
              placeholder="العربية"
              maxLength={80}
            />
          </View>
        ))}

        {options.length < MAX_OPTIONS ? (
          <Button
            label={t('post.pollAddOption')}
            variant="ghost"
            size="sm"
            icon="add"
            onPress={() => setOptions((c) => [...c, { en: '', ar: '' }])}
          />
        ) : null}

        <Button
          label={t('admin.createDailyQuestion')}
          size="lg"
          fullWidth
          disabled={!canSave}
          loading={saving}
          onPress={() => void save()}
        />
      </View>
    </SettingsScaffold>
  );
}
