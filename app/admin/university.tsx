import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';
import { SettingsScaffold } from '@/features/profile/SettingsScaffold';
import { errorTranslationKey } from '@/lib/errors';
import { queryKeys } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { fetchUniversities } from '@/services/universities';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme/ThemeProvider';

/** Configure the university streak threshold (§19/§30). */
export default function AdminUniversityScreen() {
  const theme = useTheme();
  const toast = useToast();
  const { t } = useTranslation();

  const profile = useSession((s) => s.profile);
  const [threshold, setThreshold] = useState('');
  const [saving, setSaving] = useState(false);

  const { data } = useQuery({ queryKey: queryKeys.universities, queryFn: fetchUniversities });
  const university = (data ?? []).find((u) => u.id === profile?.university_id);

  useEffect(() => {
    if (university) setThreshold(String(university.streak_threshold));
  }, [university]);

  const save = async () => {
    const value = Number.parseInt(threshold, 10);
    if (!university || !Number.isFinite(value) || value < 1) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('universities')
        .update({ streak_threshold: value })
        .eq('id', university.id);
      if (error) throw error;

      // Audit the change, as every admin action must be (§30).
      await supabase.from('admin_actions').insert({
        admin_id: profile!.id,
        action: 'set_streak_threshold',
        target_type: 'university',
        target_id: university.id,
        university_id: university.id,
        metadata: { threshold: value },
      });

      toast.show(t('common.save'), 'success');
    } catch (error) {
      toast.show(t(errorTranslationKey(error)), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsScaffold title={t('admin.streakThreshold')}>
      <View style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.lg }}>
        <Text variant="body" color="secondary">
          {t('admin.streakThresholdBody')}
        </Text>
        <TextField
          label={t('admin.streakThreshold')}
          value={threshold}
          onChangeText={setThreshold}
          keyboardType="number-pad"
          helperText={university ? `${university.member_count}` : undefined}
        />
        <Button
          label={t('common.save')}
          size="lg"
          fullWidth
          loading={saving}
          disabled={!threshold.trim()}
          onPress={() => void save()}
        />
      </View>
    </SettingsScaffold>
  );
}
