import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ThemePreference } from '@/theme/tokens';
import type { AppLanguage } from '@/locales';

export type IdentityMode = 'public' | 'anonymous';

export interface PreferencesState {
  /** null until the user has explicitly chosen; falls back to device locale. */
  language: AppLanguage | null;
  themePreference: ThemePreference;
  /** Default identity used when composing new content. */
  defaultIdentityMode: IdentityMode;
  hapticsEnabled: boolean;
  reducedMotion: boolean;
  /** Set once the user finishes onboarding, so we do not replay it. */
  onboardingCompleted: boolean;
  /** IANA zone captured at onboarding; refreshed when the device zone changes. */
  timezone: string | null;

  setLanguage: (language: AppLanguage) => void;
  setThemePreference: (preference: ThemePreference) => void;
  setDefaultIdentityMode: (mode: IdentityMode) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setReducedMotion: (enabled: boolean) => void;
  setOnboardingCompleted: (completed: boolean) => void;
  setTimezone: (timezone: string) => void;
  reset: () => void;
}

const initialState = {
  language: null,
  themePreference: 'system',
  defaultIdentityMode: 'public',
  hapticsEnabled: true,
  reducedMotion: false,
  onboardingCompleted: false,
  timezone: null,
} satisfies Partial<PreferencesState>;

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      ...initialState,
      setLanguage: (language) => set({ language }),
      setThemePreference: (themePreference) => set({ themePreference }),
      setDefaultIdentityMode: (defaultIdentityMode) => set({ defaultIdentityMode }),
      setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      setOnboardingCompleted: (onboardingCompleted) => set({ onboardingCompleted }),
      setTimezone: (timezone) => set({ timezone }),
      reset: () => set(initialState),
    }),
    {
      name: 'unistreak.preferences.v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);

/** Read preferences outside React (e.g. from i18n bootstrap). */
export const getPreferences = () => usePreferences.getState();
