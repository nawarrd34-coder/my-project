'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Locale } from '@/types/audit';
import { ar } from './ar';
import { LOCALE_COOKIE } from './constants';
import { en, type Dict } from './en';

export const dictionaries: Record<Locale, Dict> = { ar, en };

interface I18n {
  locale: Locale;
  dir: 'rtl' | 'ltr';
  t: Dict;
  setLocale: (next: Locale) => void;
}

const Ctx = createContext<I18n>({ locale: 'ar', dir: 'rtl', t: ar, setLocale: () => {} });

export function LocaleProvider({ initial, children }: { initial: Locale; children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initial);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    document.documentElement.lang = next;
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  const value = useMemo<I18n>(
    () => ({ locale, dir: locale === 'ar' ? 'rtl' : 'ltr', t: dictionaries[locale], setLocale }),
    [locale, setLocale],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
