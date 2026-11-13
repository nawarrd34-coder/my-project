import type { PageKind, PlatformId } from '@/types/business';

/** URL shapes for product and category pages, per platform plus generic fallbacks. */
const PRODUCT: Partial<Record<PlatformId, RegExp[]>> = {
  shopify: [/\/products\/[^/?#]+\/?$/i],
  salla: [/\/p\d{4,}\/?$/i],
  zid: [/\/products\/[^/?#]+\/?$/i],
  woocommerce: [/\/product\/[^/?#]+\/?$/i],
  youcan: [/\/products\/[^/?#]+\/?$/i],
  expandcart: [/route=product\/product|\/product\/[^/?#]+/i],
  opencart: [/route=product\/product/i],
};
const GENERIC_PRODUCT = [/\/(product|products|item|items|منتج|منتجات)\/[^/?#]+\/?$/i, /\/p\/[^/?#]+\/?$/i];

const CATEGORY: Partial<Record<PlatformId, RegExp[]>> = {
  shopify: [/\/collections\/[^/?#]+\/?$/i],
  salla: [/\/c\d{4,}\/?$/i],
  zid: [/\/categories\/[^/?#]+\/?$/i],
  woocommerce: [/\/product-category\/[^?#]+\/?$/i],
};
const GENERIC_CATEGORY = [/\/(category|categories|collections|collection|shop|department|تصنيف|قسم|الأقسام)\/[^/?#]+\/?$/i];

const isProductPath = (path: string, platform: PlatformId) =>
  [...(PRODUCT[platform] ?? []), ...GENERIC_PRODUCT].some((re) => re.test(path));

const isCategoryPath = (path: string, platform: PlatformId) =>
  !/\/products\//i.test(path) && [...(CATEGORY[platform] ?? []), ...GENERIC_CATEGORY].some((re) => re.test(path));

export function classifyUrl(url: string, platform: PlatformId, linkText = ''): PageKind {
  let path = '';
  try {
    const u = new URL(url);
    path = decodeURIComponent(u.pathname) + u.search;
  } catch {
    return 'other';
  }
  if (path === '/' || /^\/(ar|en)\/?$/i.test(path)) return 'home';
  if (isProductPath(path, platform)) return 'product';
  if (isCategoryPath(path, platform)) return 'category';
  const hay = `${path} ${linkText}`.toLowerCase();
  if (/\/search|[?&](q|s)=/.test(path)) return 'search';
  if (/about|who-we-are|our-story|من-نحن|عن-|من نحن|عن الشركة|قصتنا/.test(hay)) return 'about';
  if (/contact|اتصل|تواصل/.test(hay)) return 'contact';
  if (/privacy|terms|return|refund|shipping-policy|policy|policies|الخصوصية|الشروط|الاسترجاع|الاستبدال|سياسة/.test(hay)) return 'policy';
  if (/\/(blog|blogs|news|articles|مدونة)\b/.test(hay)) return 'blog';
  return 'other';
}
