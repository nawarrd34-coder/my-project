/**
 * Locale-aware, RTL-safe time formatting.
 *
 * Everything the server stores is UTC (§34); these helpers render it in the
 * reader's own locale and zone. They are pure so they can be unit tested.
 */

import { INTL_LOCALES, isSupportedLanguage } from '@/locales';

const localeFor = (language: string): string =>
  INTL_LOCALES[isSupportedLanguage(language) ? language : 'en'];

/**
 * Compact relative time for feed and chat timestamps: `now`, `5m`, `3h`, `2d`.
 * `t` is passed in so the unit suffixes come from the locale files rather than
 * being hardcoded English.
 */
export const formatRelative = (
  iso: string | Date,
  language: string,
  t: (key: string, params?: Record<string, unknown>) => string,
  now: Date = new Date(),
): string => {
  const then = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(then.getTime())) return '';

  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (seconds < 45) return t('time.justNow');
  if (seconds < 3600) return t('time.minutesShort', { value: Math.floor(seconds / 60) });
  if (seconds < 86_400) return t('time.hoursShort', { value: Math.floor(seconds / 3600) });
  if (seconds < 604_800) return t('time.daysShort', { value: Math.floor(seconds / 86_400) });
  if (seconds < 2_592_000) return t('time.weeksShort', { value: Math.floor(seconds / 604_800) });

  return new Intl.DateTimeFormat(localeFor(language), {
    day: 'numeric',
    month: 'short',
  }).format(then);
};

/** Full date, for profile "joined" lines and ban notices. */
export const formatDate = (iso: string | Date, language: string): string => {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(localeFor(language), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
};

/** Clock time for message bubbles, in the reader's own zone. */
export const formatTime = (iso: string | Date, language: string): string => {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(localeFor(language), {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

/**
 * Day separator label for a chat transcript: Today, Yesterday, or a date.
 * Comparison is done on local calendar days, not on elapsed hours, so a
 * message from 11pm yesterday reads "Yesterday" rather than "8h".
 */
export const formatDaySeparator = (
  iso: string | Date,
  language: string,
  t: (key: string) => string,
  now: Date = new Date(),
): string => {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '';

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDelta = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

  if (dayDelta === 0) return t('common.today');
  if (dayDelta === 1) return t('common.yesterday');

  return new Intl.DateTimeFormat(localeFor(language), {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(date);
};

/** Compact count for reaction chips and member counts: 1.2K, 15K. */
export const formatCompactNumber = (value: number, language: string): string =>
  new Intl.NumberFormat(localeFor(language), {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
