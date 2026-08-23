import en from './en.json';
import ar from './ar.json';

export const SUPPORTED_LANGUAGES = ['en', 'ar'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const RTL_LANGUAGES: ReadonlySet<AppLanguage> = new Set<AppLanguage>(['ar']);

export const isRTLLanguage = (language: AppLanguage): boolean => RTL_LANGUAGES.has(language);

/** Native label for each language, shown in the language switcher (§4). */
export const LANGUAGE_LABELS: Record<AppLanguage, string> = {
  en: 'English',
  ar: 'العربية',
};

/**
 * BCP-47 locale used for Intl formatting (dates, numbers, relative time).
 * `ar` alone gives Eastern Arabic numerals on some platforms; we pin the
 * Latin-numeral variant so streak counts stay legible next to the fire icon.
 */
export const INTL_LOCALES: Record<AppLanguage, string> = {
  en: 'en-US',
  ar: 'ar-SA-u-nu-latn',
};

export const resources = {
  en: { translation: en },
  ar: { translation: ar },
} as const;

export const isSupportedLanguage = (value: string | null | undefined): value is AppLanguage =>
  !!value && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);

/** Map a device locale like `ar-SA` or `en-GB` onto a supported language. */
export const resolveLanguage = (locales: readonly string[]): AppLanguage => {
  for (const locale of locales) {
    const base = locale.split('-')[0]?.toLowerCase();
    if (isSupportedLanguage(base)) return base;
  }
  return 'en';
};
