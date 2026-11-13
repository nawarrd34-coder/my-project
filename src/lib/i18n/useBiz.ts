'use client';

import { useI18n } from '@/lib/i18n';
import { bizDicts, type BizDict } from './biz';

export function useBiz(): BizDict {
  const { locale } = useI18n();
  return bizDicts[locale];
}
