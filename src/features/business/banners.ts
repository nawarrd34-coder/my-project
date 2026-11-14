import type { BannerImage } from '@/types/business';
import { absUrl, clean, type Doc } from './html';

const SLIDER = /slider|swiper|carousel|slick|slideshow|splide|glide|owl-|flickity|hero|banner/i;

export interface BannerCandidate {
  src: string;
  alt: string | null;
  attrWidth: number | null;
  attrHeight: number | null;
  responsive: boolean;
  mobileVariant: boolean;
  inSlider: boolean;
  linked: boolean;
}

const num = (v: string | undefined) => {
  const n = Number(String(v ?? '').replace(/px$/, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Pick the largest candidate from a srcset string. */
function largestFromSrcset(srcset: string | undefined, base: string): string | null {
  if (!srcset) return null;
  const parts = srcset
    .split(',')
    .map((p) => p.trim().split(/\s+/))
    .filter((p) => p[0])
    .map(([u, d]) => ({ u, w: Number(String(d ?? '').replace(/[wx]$/, '')) || 0 }))
    .sort((a, b) => b.w - a.w);
  return parts[0] ? absUrl(parts[0].u, base) : null;
}

/**
 * Promotional banners on the homepage: images inside slider/hero/banner
 * containers, plus very wide images and inline background images in those
 * containers. Returns at most `limit` unique images.
 */
export function findBanners($: Doc, base: string, limit = 8): { candidates: BannerCandidate[]; sliders: number } {
  const out = new Map<string, BannerCandidate>();
  const containers = $('[class], [id], salla-slider, salla-slider-banner')
    .filter((_, el) => SLIDER.test(`${$(el).attr('class') ?? ''} ${$(el).attr('id') ?? ''} ${el.tagName}`))
    .filter((_, el) => $(el).closest('header nav, footer').length === 0);
  const sliders = containers.filter((_, el) => /slider|swiper|carousel|slick|slideshow|splide|glide|owl-|flickity/i.test(`${$(el).attr('class') ?? ''} ${el.tagName}`) && $(el).find('img, picture').length > 1).length;

  const consider = (el: Parameters<Doc>[0], inSlider: boolean) => {
    const img = $(el);
    const pic = img.closest('picture');
    const src =
      absUrl(img.attr('src') && !img.attr('src')!.startsWith('data:') ? img.attr('src') : img.attr('data-src') ?? img.attr('data-lazy-src') ?? img.attr('data-original'), base) ??
      largestFromSrcset(img.attr('srcset') ?? img.attr('data-srcset'), base);
    if (!src || out.has(src) || /logo|icon|sprite|avatar|payment|mada|visa|badge/i.test(src)) return;
    const w = num(img.attr('width'));
    const h = num(img.attr('height'));
    if (!inSlider && !(w && w >= 900)) return;
    if (w && h && w < 300 && h < 300) return;
    out.set(src, {
      src,
      alt: clean(img.attr('alt')),
      attrWidth: w,
      attrHeight: h,
      responsive: !!(img.attr('srcset') || img.attr('data-srcset') || img.attr('sizes') || pic.find('source').length),
      mobileVariant: pic.find('source[media*="max-width" i], source[media*="min-width" i]').length > 0,
      inSlider,
      linked: img.closest('a').length > 0,
    });
  };

  containers.find('img').each((_, el) => {
    if (out.size < limit) consider(el, true);
  });
  $('img').each((_, el) => {
    if (out.size < limit) consider(el, false);
  });
  // Inline background images on hero/banner blocks.
  containers.each((_, el) => {
    if (out.size >= limit) return;
    const m = /background(-image)?\s*:[^;]*url\(['"]?([^'")]+)/i.exec($(el).attr('style') ?? '');
    const src = m ? absUrl(m[2], base) : null;
    if (src && !out.has(src)) {
      out.set(src, { src, alt: null, attrWidth: null, attrHeight: null, responsive: false, mobileVariant: false, inSlider: true, linked: $(el).closest('a').length > 0 || $(el).find('a').length > 0 });
    }
  });
  return { candidates: [...out.values()].slice(0, limit), sliders };
}

export function toBannerImage(c: BannerCandidate, meta: { width: number; height: number; format: string } | null, bytes: number | null): BannerImage {
  const width = meta?.width ?? c.attrWidth;
  const height = meta?.height ?? c.attrHeight;
  return {
    src: c.src,
    alt: c.alt,
    width,
    height,
    ratio: width && height ? Math.round((width / height) * 100) / 100 : null,
    bytes,
    format: meta?.format ?? null,
    responsive: c.responsive,
    mobileVariant: c.mobileVariant,
    inSlider: c.inSlider,
    linked: c.linked,
    measured: !!meta,
  };
}
