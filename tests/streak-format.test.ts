import {
  bucketFor,
  canRestore,
  countdownTo,
  formatCountdown,
  formatStreakCount,
  isExpiringSoon,
  isMilestone,
  nextMilestone,
} from '@/features/streaks/format';

const NOW = new Date('2026-03-10T12:00:00.000Z');
const inHours = (h: number) => new Date(NOW.getTime() + h * 3600_000).toISOString();
const agoHours = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();

describe('countdown', () => {
  it('breaks a deadline into hours, minutes and seconds', () => {
    const c = countdownTo('2026-03-10T15:42:18.000Z', NOW);
    expect(c).toMatchObject({ hours: 3, minutes: 42, seconds: 18, expired: false });
    expect(formatCountdown(c)).toBe('03:42:18');
  });

  it('pads single digits so the timer does not jitter in width', () => {
    expect(formatCountdown(countdownTo('2026-03-10T13:05:07.000Z', NOW))).toBe('01:05:07');
  });

  it('treats a passed deadline as expired rather than negative', () => {
    const c = countdownTo(agoHours(2), NOW);
    expect(c.expired).toBe(true);
    expect(c.totalMs).toBe(0);
    expect(formatCountdown(c)).toBe('00:00:00');
  });

  it('handles a missing or malformed deadline without throwing', () => {
    expect(countdownTo(null, NOW).expired).toBe(true);
    expect(countdownTo('not-a-date', NOW).expired).toBe(true);
  });

  it('is timezone independent: the same instant yields the same countdown', () => {
    // The server hands us an absolute instant, so a reader in Riyadh and a
    // reader in New York must see the identical remaining time.
    const deadline = '2026-03-10T21:00:00.000Z';
    const fromRiyadhClock = countdownTo(deadline, new Date('2026-03-11T00:00:00+03:00'));
    const fromNewYorkClock = countdownTo(deadline, new Date('2026-03-10T16:00:00-05:00'));
    expect(fromRiyadhClock.totalMs).toBe(fromNewYorkClock.totalMs);
  });
});

describe('milestones', () => {
  it('recognises the specified milestones', () => {
    for (const m of [7, 30, 50, 100, 365]) expect(isMilestone(m)).toBe(true);
  });

  it('does not treat ordinary days as milestones', () => {
    for (const n of [1, 2, 6, 8, 29, 99, 364, 400]) expect(isMilestone(n)).toBe(false);
  });

  it('reports the next milestone to aim for', () => {
    expect(nextMilestone(0)).toBe(7);
    expect(nextMilestone(7)).toBe(30);
    expect(nextMilestone(101)).toBe(365);
    expect(nextMilestone(365)).toBeNull();
  });
});

describe('bucketing for the Streaks screen', () => {
  const base = { status: 'active' as const, currentLength: 12, expiresAt: inHours(20) };

  it('puts a healthy streak in active', () => {
    expect(bucketFor(base, NOW)).toBe('active');
  });

  it('promotes a streak inside the reminder window to expiring', () => {
    expect(bucketFor({ ...base, expiresAt: inHours(3) }, NOW)).toBe('expiring');
  });

  it('treats a pending streak as new, not active', () => {
    expect(bucketFor({ status: 'pending', currentLength: 0, expiresAt: inHours(20) }, NOW)).toBe('new');
  });

  it('keeps an expired streak visible in past', () => {
    expect(bucketFor({ status: 'expired', currentLength: 0, expiresAt: null }, NOW)).toBe('past');
  });

  it('never marks an expired streak as expiring soon', () => {
    expect(isExpiringSoon(inHours(1), 'expired', NOW)).toBe(false);
  });
});

describe('restore eligibility', () => {
  it('offers restore inside the 24 hour window', () => {
    expect(canRestore({ status: 'expired', expiredAt: agoHours(3), longestLength: 83 }, NOW)).toBe(true);
  });

  it('withdraws restore once the window closes', () => {
    expect(canRestore({ status: 'expired', expiredAt: agoHours(25), longestLength: 83 }, NOW)).toBe(false);
  });

  it('does not offer restore for a streak that never counted', () => {
    expect(canRestore({ status: 'expired', expiredAt: agoHours(1), longestLength: 0 }, NOW)).toBe(false);
  });

  it('does not offer restore for a live streak', () => {
    expect(canRestore({ status: 'active', expiredAt: null, longestLength: 40 }, NOW)).toBe(false);
  });
});

describe('number formatting', () => {
  it('formats counts for English', () => {
    expect(formatStreakCount(1234, 'en')).toBe('1,234');
  });

  it('uses Latin digits in Arabic so the fire badge stays legible', () => {
    expect(formatStreakCount(365, 'ar')).toMatch(/^\d+$/);
  });
});
