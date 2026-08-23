import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import {
  INTL_LOCALES,
  isSupportedLanguage,
  resolveLanguage,
  resources,
  type AppLanguage,
} from '@/locales';
import { getPreferences } from '@/store/preferences';

/**
 * Language resolution order:
 *   1. explicit user choice (persisted)
 *   2. device locale, if we support it
 *   3. English
 */
export const detectInitialLanguage = (): AppLanguage => {
  const stored = getPreferences().language;
  if (isSupportedLanguage(stored)) return stored;
  return resolveLanguage(Localization.getLocales().map((l) => l.languageTag));
};

let initialised = false;

export const initI18n = (language: AppLanguage = detectInitialLanguage()) => {
  if (initialised) return i18n;
  initialised = true;

  void i18n.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: 'en',
    defaultNS: 'translation',
    // React already escapes rendered strings; double-escaping mangles Arabic
    // punctuation and interpolated usernames.
    interpolation: { escapeValue: false },
    returnNull: false,
    compatibilityJSON: 'v4',
  });

  return i18n;
};

export const changeLanguage = async (language: AppLanguage) => {
  await i18n.changeLanguage(language);
};

/** Locale string for Intl APIs, derived from the active i18n language. */
export const currentIntlLocale = (): string => {
  const lang = isSupportedLanguage(i18n.language) ? i18n.language : 'en';
  return INTL_LOCALES[lang];
};

export default i18n;
