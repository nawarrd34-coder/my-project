import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useRouter, useSegments } from 'expo-router';

import { useAuthBootstrap } from '@/hooks/useAuthBootstrap';
import { useSession } from '@/store/session';
import { usePreferences } from '@/store/preferences';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Single place that decides which half of the app you are allowed into.
 *
 * Guarding here rather than in each screen means there is no window in which
 * a protected screen renders before a redirect fires.
 */
export const AppGate = ({ children }: { children: ReactNode }) => {
  const theme = useTheme();
  const router = useRouter();
  const segments = useSegments();

  useAuthBootstrap();

  const session = useSession((s) => s.session);
  const profile = useSession((s) => s.profile);
  const initializing = useSession((s) => s.initializing);
  const onboardingCompleted = usePreferences((s) => s.onboardingCompleted);

  const resolved = !initializing && session !== undefined;

  useEffect(() => {
    if (resolved) void SplashScreen.hideAsync();
  }, [resolved]);

  useEffect(() => {
    if (!resolved) return;

    const inOnboarding = segments[0] === '(onboarding)';
    // A user is "ready" only with both an account and a profile row: an
    // interrupted signup must resume onboarding, not land on an empty feed.
    const ready = !!session && !!profile && onboardingCompleted;

    if (!ready && !inOnboarding) {
      router.replace('/(onboarding)');
    } else if (ready && inOnboarding) {
      router.replace('/(tabs)');
    }
  }, [resolved, session, profile, onboardingCompleted, segments, router]);

  if (!resolved) {
    return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  }

  return <>{children}</>;
};
