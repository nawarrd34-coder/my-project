import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Localization from 'expo-localization';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';

import { AppGate } from '@/navigation/AppGate';
import { ToastProvider } from '@/components/ui/Toast';
import i18n, { detectInitialLanguage, initI18n } from '@/lib/i18n';
import { createQueryClient } from '@/lib/queryClient';
import { applyLayoutDirection } from '@/lib/rtl';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { usePreferences } from '@/store/preferences';

void SplashScreen.preventAutoHideAsync();

const queryClient = createQueryClient();

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const bootstrap = async () => {
      // Rehydrate persisted preferences before i18n reads them, otherwise the
      // first frame renders in the wrong language.
      await usePreferences.persist.rehydrate();

      const language = detectInitialLanguage();
      initI18n(language);

      // Capture the device timezone once at startup; every streak deadline is
      // resolved against the user's zone server-side (§34).
      const zone = Localization.getCalendars()[0]?.timeZone;
      if (zone) usePreferences.getState().setTimezone(zone);

      // If this is a fresh install in an RTL locale, applying the direction
      // reloads once - before anything is on screen.
      await applyLayoutDirection(language);

      setReady(true);
    };

    void bootstrap();
  }, []);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nextProvider i18n={i18n}>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <ToastProvider>
                <ThemedStatusBar />
                <AppGate>
                  <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
                    <Stack.Screen name="(onboarding)" />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="chat/[id]" />
                    <Stack.Screen name="post/[id]" />
                    <Stack.Screen name="profile/[id]" />
                    <Stack.Screen name="settings" />
                    <Stack.Screen name="admin" />
                    <Stack.Screen
                      name="compose"
                      options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
                    />
                  </Stack>
                </AppGate>
              </ToastProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </I18nextProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Status bar contrast has to follow the resolved theme, not the OS setting. */
const ThemedStatusBar = () => {
  const theme = useTheme();
  return <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />;
};
