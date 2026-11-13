import { bizAr } from './biz.ar';
import { bizEn, type BizDict } from './biz.en';

/** Plain (server-safe) module: the PDF template imports this directly. */
export const bizDicts: Record<'ar' | 'en', BizDict> = { ar: bizAr, en: bizEn };
export type { BizDict };
