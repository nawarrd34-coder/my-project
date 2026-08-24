import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { changeLanguage } from '@/lib/i18n';
import { applyLayoutDirection } from '@/lib/rtl';
import { isRTLLanguage, isSupportedLanguage, type AppLanguage } from '@/locales';
import { updateMyProfile } from '@/services/profiles';
import { usePreferences } from '@/store/preferences';
import { useSession } from '@/store/session';

export interface LanguageApi {
  language: AppLanguage;
  isRTL: boolean;
  /**
   * Switch language everywhere: i18next, persisted preference, the server
   * profile (so notifications arrive in the right language) and, when the
   * writing direction changes, the native layout direction.
   *
   * Resolves to true when a reload was triggered for the direction change.
   */
  setLanguage: (next: AppLanguage) => Promise<boolean>;
}

export const useLanguage = (): LanguageApi => {
  const { i18n } = useTranslation();
  const setStoredLanguage = usePreferences((s) => s.setLanguage);
  const session = useSession((s) => s.session);

  const current: AppLanguage = isSupportedLanguage(i18n.language) ? i18n.language : 'en';

  const setLanguage = useCallback(
    async (next: AppLanguage) => {
      setStoredLanguage(next);
      await changeLanguage(next);

      // Best-effort: a failure here must not block the UI language change.
      if (session) {
        try {
          await updateMyProfile({ locale: next });
        } catch {
          // Ignored: the local preference is already applied.
        }
      }

      return applyLayoutDirection(next);
    },
    [session, setStoredLanguage],
  );

  return { language: current, isRTL: isRTLLanguage(current), setLanguage };
};
