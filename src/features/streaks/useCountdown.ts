import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { countdownTo, formatCountdown, type Countdown } from './format';

/**
 * A live countdown to a streak deadline (§17).
 *
 * Recomputed from the absolute deadline on every tick rather than decremented,
 * so it stays accurate when the OS throttles timers in the background. It also
 * resyncs on foreground, which is when a drifted timer would otherwise be
 * visible.
 */
export const useCountdown = (expiresAt: string | null): Countdown & { formatted: string } => {
  const [countdown, setCountdown] = useState<Countdown>(() => countdownTo(expiresAt));

  useEffect(() => {
    if (!expiresAt) return;

    const tick = () => setCountdown(countdownTo(expiresAt));
    tick();

    const interval = setInterval(tick, 1000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [expiresAt]);

  return { ...countdown, formatted: formatCountdown(countdown) };
};
