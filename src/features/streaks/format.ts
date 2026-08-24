/**
 * Pure presentation helpers for streaks.
 *
 * The authoritative streak state comes from the server (§33); nothing here
 * decides whether a streak counts. These functions only turn that state into
 * text and countdowns, which is why they are pure and unit tested.
 */

import { INTL_LOCALES, isSupportedLanguage } from '@/locales';

/** Milestones that deserve a celebration (§16). */
export const STREAK_MILESTONES = [7, 30, 50, 100, 365] as const;

export type StreakStatus = 'pending' | 'active' | 'expired' | 'restored';

const localeFor = (language: string): string =>
  INTL_LOCALES[isSupportedLanguage(language) ? language : 'en'];

/** Locale-aware number, so Arabic gets the right grouping separators. */
export const formatStreakCount = (count: number, language: string): string =>
  new Intl.NumberFormat(localeFor(language)).format(count);

export const isMilestone = (count: number): boolean =>
  (STREAK_MILESTONES as readonly number[]).includes(count);

/**
 * The next milestone above `count`, or null once every milestone is passed.
 * Drives the "x days to your next badge" hint.
 */
export const nextMilestone = (count: number): number | null =>
  STREAK_MILESTONES.find((m) => m > count) ?? null;

export interface Countdown {
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  expired: boolean;
}

/**
 * Time remaining until a streak deadline.
 *
 * `expiresAt` is an absolute instant computed by the server in the streak's
 * timezone, so subtracting `now` is already correct for a user in any zone -
 * there is no client-side timezone maths to get wrong (§34).
 */
export const countdownTo = (expiresAt: string | Date | null, now: Date = new Date()): Countdown => {
  if (!expiresAt) return { hours: 0, minutes: 0, seconds: 0, totalMs: 0, expired: true };

  const target = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  const totalMs = target.getTime() - now.getTime();

  if (Number.isNaN(totalMs) || totalMs <= 0) {
    return { hours: 0, minutes: 0, seconds: 0, totalMs: 0, expired: true };
  }

  const totalSeconds = Math.floor(totalMs / 1000);
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    totalMs,
    expired: false,
  };
};

/** `03:42:18`, as shown on the Expiring Soon card (§17). */
export const formatCountdown = (countdown: Countdown): string => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(countdown.hours)}:${pad(countdown.minutes)}:${pad(countdown.seconds)}`;
};

/** A streak is "expiring soon" once it is inside the reminder window. */
export const EXPIRING_SOON_MS = 6 * 60 * 60 * 1000;

export const isExpiringSoon = (
  expiresAt: string | Date | null,
  status: StreakStatus,
  now: Date = new Date(),
): boolean => {
  if (status === 'expired') return false;
  const { totalMs, expired } = countdownTo(expiresAt, now);
  return !expired && totalMs <= EXPIRING_SOON_MS;
};

/**
 * How a streak should be grouped on the Streaks screen (§17).
 *
 *  - `expiring` takes priority: it is the only actionable bucket.
 *  - `new` is a streak that has not yet counted a day (still pending).
 *  - `past` is an expired streak, kept so the user can see and restore it.
 */
export type StreakBucket = 'expiring' | 'active' | 'new' | 'past';

export const bucketFor = (
  streak: { status: StreakStatus; currentLength: number; expiresAt: string | null },
  now: Date = new Date(),
): StreakBucket => {
  if (streak.status === 'expired') return 'past';
  if (isExpiringSoon(streak.expiresAt, streak.status, now)) return 'expiring';
  if (streak.status === 'pending' || streak.currentLength === 0) return 'new';
  return 'active';
};

/** Restore is only offered briefly after a lapse; mirrors the server rule. */
export const RESTORE_WINDOW_MS = 24 * 60 * 60 * 1000;

export const canRestore = (
  streak: { status: StreakStatus; expiredAt: string | null; longestLength: number },
  now: Date = new Date(),
): boolean => {
  if (streak.status !== 'expired' || !streak.expiredAt) return false;
  if (streak.longestLength < 2) return false;
  return now.getTime() - new Date(streak.expiredAt).getTime() <= RESTORE_WINDOW_MS;
};
