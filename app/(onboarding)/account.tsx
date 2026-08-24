import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { OnboardingScaffold } from '@/features/onboarding/OnboardingScaffold';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { errorTranslationKey } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { checkUsernameAvailable } from '@/services/profiles';
import { useOnboardingDraft } from '@/store/onboarding';
import { useTheme } from '@/theme/ThemeProvider';

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;

export default function AccountStep() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ mode?: string }>();
  const isSignIn = params.mode === 'signin';

  const username = useOnboardingDraft((s) => s.username);
  const setUsername = useOnboardingDraft((s) => s.setUsername);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const debouncedUsername = useDebouncedValue(username);
  const usernameWellFormed = USERNAME_PATTERN.test(debouncedUsername);

  // Availability is checked as you type, but the real uniqueness guarantee is
  // the database's unique index - this is a courtesy, not a gate.
  const { data: available, isFetching: checking } = useQuery({
    queryKey: ['username-available', debouncedUsername],
    queryFn: () => checkUsernameAvailable(debouncedUsername),
    enabled: !isSignIn && usernameWellFormed,
    staleTime: 10_000,
  });

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passwordValid = password.length >= 8;

  const canSubmit = isSignIn
    ? emailValid && password.length > 0
    : emailValid && passwordValid && usernameWellFormed && available === true;

  const submit = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      if (isSignIn) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // AppGate routes onward: to the tabs if a profile exists, or back
        // into onboarding to finish it.
        return;
      }

      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      router.push('/(onboarding)/identity');
    } catch (error) {
      setFormError(t(errorTranslationKey(error)));
    } finally {
      setSubmitting(false);
    }
  };

  const usernameStatus = () => {
    if (!username) return undefined;
    if (!USERNAME_PATTERN.test(username)) return t('errors.usernameInvalid');
    if (available === false) return t('errors.usernameTaken');
    return undefined;
  };

  return (
    <OnboardingScaffold
      step={4}
      totalSteps={5}
      title={isSignIn ? t('auth.signIn') : t('onboarding.accountTitle')}
      body={isSignIn ? undefined : t('onboarding.accountBody')}
      footer={
        <>
          {formError ? (
            <Text variant="caption" color="error" align="center">
              {formError}
            </Text>
          ) : null}
          <Button
            label={isSignIn ? t('auth.signIn') : t('common.next')}
            size="lg"
            fullWidth
            loading={submitting}
            disabled={!canSubmit}
            onPress={() => void submit()}
          />
        </>
      }
    >
      <View style={{ gap: theme.spacing.lg }}>
        {!isSignIn ? (
          <TextField
            label={t('onboarding.usernameTitle')}
            value={username}
            onChangeText={setUsername}
            placeholder={t('onboarding.usernamePlaceholder')}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
            icon="at"
            errorText={usernameStatus()}
            helperText={
              checking
                ? t('onboarding.usernameChecking')
                : available === true
                  ? t('onboarding.usernameAvailable')
                  : t('onboarding.usernameBody')
            }
            trailing={
              checking ? (
                <ActivityIndicator size="small" color={theme.colors.textMuted} />
              ) : available === true ? (
                <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
              ) : null
            }
          />
        ) : null}

        <TextField
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          placeholder={t('auth.emailPlaceholder')}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          icon="mail"
        />

        <TextField
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          placeholder={t('auth.passwordPlaceholder')}
          secureTextEntry
          autoCapitalize="none"
          autoComplete={isSignIn ? 'current-password' : 'new-password'}
          icon="lock-closed"
          errorText={password.length > 0 && !passwordValid ? t('errors.weakPassword') : undefined}
        />
      </View>
    </OnboardingScaffold>
  );
}
