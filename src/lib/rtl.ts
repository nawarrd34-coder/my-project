import { I18nManager } from 'react-native';
import * as Updates from 'expo-updates';

import { isRTLLanguage, type AppLanguage } from '@/locales';

/**
 * React Native mirrors layout at the native level, so switching between an
 * LTR and an RTL language requires a reload to take effect. We only reload
 * when the direction actually changes — switching between two LTR languages
 * must not restart the app.
 *
 * Returns true if a direction change was applied (and a reload was requested).
 */
export const applyLayoutDirection = async (language: AppLanguage): Promise<boolean> => {
  const shouldBeRTL = isRTLLanguage(language);
  if (I18nManager.isRTL === shouldBeRTL) return false;

  I18nManager.allowRTL(shouldBeRTL);
  I18nManager.forceRTL(shouldBeRTL);

  // In a development client or Expo Go, reloadAsync is unavailable or a no-op;
  // the direction still applies on the next manual reload.
  try {
    await Updates.reloadAsync();
  } catch {
    // Swallow: the caller shows a "restart to apply" hint instead.
  }
  return true;
};

/** True when the app is currently laid out right-to-left. */
export const isLayoutRTL = (): boolean => I18nManager.isRTL;

/**
 * Directional value picker for the rare case where a style cannot be
 * expressed with logical properties (`marginStart`, `end`, `textAlign: 'left'`
 * auto-flips, etc). Prefer logical properties over this helper.
 */
export const byDirection = <T,>(ltr: T, rtl: T): T => (I18nManager.isRTL ? rtl : ltr);

/**
 * Chevron/arrow glyph names flip in RTL. Icons that denote *direction of
 * travel* mirror; icons that denote a *thing* (a heart, a camera) never do.
 */
export const forwardChevron = (): 'chevron-forward' | 'chevron-back' =>
  I18nManager.isRTL ? 'chevron-back' : 'chevron-forward';

export const backChevron = (): 'chevron-forward' | 'chevron-back' =>
  I18nManager.isRTL ? 'chevron-forward' : 'chevron-back';
