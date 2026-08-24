import { useEffect, useState } from 'react';

/** Delay a rapidly changing value, for debounced search and validation (§35). */
export const useDebouncedValue = <T,>(value: T, delayMs = 350): T => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
};
