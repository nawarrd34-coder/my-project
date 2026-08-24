import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { SelectRow } from '@/components/ui/SelectRow';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { OnboardingScaffold } from '@/features/onboarding/OnboardingScaffold';
import { errorTranslationKey } from '@/lib/errors';
import { queryKeys } from '@/lib/queryClient';
import { fetchUniversities } from '@/services/universities';
import { useOnboardingDraft } from '@/store/onboarding';
import { useTheme } from '@/theme/ThemeProvider';

export default function UniversityStep() {
  const theme = useTheme();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState('');

  const universityId = useOnboardingDraft((s) => s.universityId);
  const setUniversity = useOnboardingDraft((s) => s.setUniversity);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.universities,
    queryFn: fetchUniversities,
  });

  const isArabic = i18n.language === 'ar';

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = data ?? [];
    if (!term) return list;
    return list.filter(
      (u) =>
        u.name_en.toLowerCase().includes(term) ||
        u.name_ar.includes(search.trim()) ||
        u.code.toLowerCase().includes(term),
    );
  }, [data, search]);

  return (
    <OnboardingScaffold
      step={3}
      totalSteps={5}
      title={t('onboarding.universityTitle')}
      body={t('onboarding.universityBody')}
      footer={
        <Button
          label={t('common.next')}
          size="lg"
          fullWidth
          disabled={!universityId}
          onPress={() => router.push('/(onboarding)/account')}
        />
      }
    >
      <TextField
        value={search}
        onChangeText={setSearch}
        placeholder={t('onboarding.universitySearch')}
        icon="search"
        autoCorrect={false}
      />

      {isLoading ? (
        <View style={{ gap: theme.spacing.sm }}>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} height={68} radius={theme.radius.md} />
          ))}
        </View>
      ) : error ? (
        <ErrorState message={t(errorTranslationKey(error))} onRetry={() => void refetch()} compact />
      ) : filtered.length === 0 ? (
        <Text variant="callout" color="secondary" align="center">
          {t('empty.searchTitle')}
        </Text>
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          {filtered.map((university) => (
            <SelectRow
              key={university.id}
              label={isArabic ? university.name_ar : university.name_en}
              description={t('university.members', { count: university.member_count })}
              selected={universityId === university.id}
              leading={
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: theme.radius.sm,
                    backgroundColor: university.brand_color,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text variant="captionStrong" style={{ color: '#FFFFFF' }}>
                    {university.code.slice(0, 3)}
                  </Text>
                </View>
              }
              onPress={() =>
                setUniversity(
                  university.id,
                  isArabic ? university.short_name_ar : university.short_name_en,
                )
              }
            />
          ))}
        </View>
      )}
    </OnboardingScaffold>
  );
}
