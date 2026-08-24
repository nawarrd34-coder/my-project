import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { Platform } from 'react-native';

import { usePreferences } from '@/store/preferences';

export type HapticKind = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'select';

/**
 * Haptics respecting the user's preference. Web has no haptics API, so every
 * call is a no-op there rather than a thrown promise rejection.
 */
export const useHaptics = () => {
  const enabled = usePreferences((s) => s.hapticsEnabled);

  return useCallback(
    (kind: HapticKind = 'light') => {
      if (!enabled || Platform.OS === 'web') return;
      switch (kind) {
        case 'light':
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case 'success':
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'warning':
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        case 'error':
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
        case 'select':
          void Haptics.selectionAsync();
          break;
      }
    },
    [enabled],
  );
};
