import type { Locale } from '@/types/audit';
import { proAr } from './copy.ar';
import { proEn, type CriterionCopy, type ProDict } from './copy.en';

export const proDicts: Record<Locale, ProDict> = { ar: proAr, en: proEn };
export type { CriterionCopy, ProDict };

export const criterionCopy = (locale: Locale, id: string): CriterionCopy | null => (proDicts[locale].criteria as Record<string, CriterionCopy>)[id] ?? null;
