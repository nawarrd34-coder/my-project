import type { PlatformId, ProductSample } from '@/types/business';
import { absUrl, bodyText, clean, clip, jsonLd, ldTypes, sameSite, str, type Doc } from './html';
import { classifyUrl } from './patterns';

export const ADD_TO_CART =
  /add[\s-]?to[\s-]?(cart|bag|basket)|buy now|أضف (الى|إلى|لل)سلة|اضف (الى|إلى|لل)سلة|إضافة (الى|إلى|لل)سلة|أضف للسلة|اضف للسلة|اشتر الآن|شراء الآن|أضف إلى العربة/i;
const RELATED = /related products|you may also like|recommended for you|customers also|منتجات مشابهة|منتجات ذات صلة|قد يعجبك|قد يعجبك أيضا|اشترى العملاء أيضا|منتجات مقترحة/i;
const PRICE = /(\d[\d,.]*)\s?(ر\.?\s?س|ريال|SAR|SR|USD|\$|AED|KWD|د\.ك|QAR|درهم)|(SAR|ر\.س|USD|\$|AED)\s?(\d[\d,.]*)/i;
const AVAILABILITY_TEXT = /in stock|out of stock|sold out|متوفر|غير متوفر|نفذت الكمية|نفدت الكمية|متبقي \d+|آخر \d+ قطع/i;

export interface PageLinks {
  products: Map<string, string>;
  categories: Map<string, string>;
  other: { url: string; text: string }[];
  internalCount: number;
}

/** Collect internal links on a page and sort them into products, categories and other pages. */
export function collectLinks($: Doc, pageUrl: string, platform: PlatformId): PageLinks {
  const products = new Map<string, string>();
  const categories = new Map<string, string>();
  const other: { url: string; text: string }[] = [];
  const seen = new Set<string>();
  $('a[href]').each((_, el) => {
    const url = absUrl($(el).attr('href'), pageUrl);
    if (!url || !sameSite(url, pageUrl) || seen.has(url)) return;
    seen.add(url);
    const text = clean($(el).text()) ?? clean($(el).attr('aria-label')) ?? clean($(el).find('img').attr('alt')) ?? '';
    const kind = classifyUrl(url, platform, text);
    if (kind === 'product') products.set(url, clip(text, 120));
    else if (kind === 'category') categories.set(url, clip(text, 60));
    else other.push({ url, text: clip(text, 60) });
  });
  return { products, categories, other, internalCount: seen.size };
}

function imagesFrom(v: unknown, base: string): string[] {
  const list = Array.isArray(v) ? v : v ? [v] : [];
  return list.map((x) => absUrl(str(x), base)).filter((x): x is string => !!x);
}

/** Read one product page: structured data first, then microdata, Open Graph and visible HTML. */
export function parseProductPage($: Doc, url: string): ProductSample {
  const ld = jsonLd($).find((o) => ldTypes(o).includes('product'));
  const text = bodyText($);
  const addToCart =
    $('button, input[type="submit"], a, salla-add-product-button, [class*="add-to-cart" i], [name="add-to-cart"]')
      .toArray()
      .some((el) => {
        const node = $(el);
        const label = `${node.text()} ${node.attr('value') ?? ''} ${node.attr('aria-label') ?? ''} ${node.attr('class') ?? ''} ${node.attr('name') ?? ''}`;
        return ADD_TO_CART.test(label) || /add-to-cart|addtocart|add_to_cart/i.test(label) || el.tagName === 'salla-add-product-button';
      }) || $('form[action*="/cart/add" i]').length > 0;
  const related = RELATED.test(text);

  if (ld) {
    const offers = (Array.isArray(ld.offers) ? ld.offers[0] : ld.offers) as Record<string, unknown> | undefined;
    const priceSpec = offers?.priceSpecification as Record<string, unknown> | undefined;
    const price = str(offers?.price ?? offers?.lowPrice ?? priceSpec?.price);
    const images = imagesFrom(ld.image, url);
    const gallery = Math.max(images.length, galleryCount($));
    return {
      url,
      name: str(ld.name) ? clip(str(ld.name)!, 140) : null,
      image: images[0] ?? absUrl($('meta[property="og:image" i]').attr('content'), url),
      imageCount: gallery,
      price,
      currency: str(offers?.priceCurrency ?? priceSpec?.priceCurrency),
      descriptionLength: (str(ld.description) ?? '').length || descriptionLength($),
      availability: str(offers?.availability)?.replace(/^https?:\/\/schema\.org\//i, '') ?? (AVAILABILITY_TEXT.exec(text)?.[0] ?? null),
      addToCart,
      related,
      source: 'json-ld',
    };
  }

  const microName = clean($('[itemprop="name"]').first().text() || $('[itemprop="name"]').first().attr('content'));
  const microPrice = clean($('[itemprop="price"]').first().attr('content') ?? $('[itemprop="price"]').first().text());
  const ogType = $('meta[property="og:type" i]').attr('content') ?? '';
  const ogPrice = clean($('meta[property="product:price:amount" i], meta[property="og:price:amount" i]').attr('content'));
  const h1 = clean($('h1').first().text());
  const priceMatch = PRICE.exec(text);
  const source: ProductSample['source'] = microName || microPrice ? 'microdata' : /product/i.test(ogType) || ogPrice ? 'open-graph' : 'html';
  return {
    url,
    name: microName ?? clean($('meta[property="og:title" i]').attr('content')) ?? h1,
    image: absUrl($('meta[property="og:image" i]').attr('content'), url),
    imageCount: galleryCount($),
    price: microPrice ?? ogPrice ?? (priceMatch ? (priceMatch[1] ?? priceMatch[4]) : null),
    currency: clean($('[itemprop="priceCurrency"]').attr('content') ?? $('meta[property="product:price:currency" i]').attr('content')) ?? (priceMatch ? (priceMatch[2] ?? priceMatch[3]) : null),
    descriptionLength: descriptionLength($),
    availability: clean($('[itemprop="availability"]').attr('content') ?? $('[itemprop="availability"]').attr('href'))?.replace(/^https?:\/\/schema\.org\//i, '') ?? (AVAILABILITY_TEXT.exec(text)?.[0] ?? null),
    addToCart,
    related,
    source,
  };
}

function galleryCount($: Doc): number {
  const sel = '[class*="gallery" i] img, [class*="product-image" i] img, [class*="product__media" i] img, [class*="slider" i] img, [itemprop="image"], salla-slider img, .woocommerce-product-gallery img';
  const srcs = new Set($(sel).map((_, el) => $(el).attr('src') ?? $(el).attr('data-src') ?? $(el).attr('content') ?? '').get().filter(Boolean));
  return srcs.size;
}

function descriptionLength($: Doc): number {
  const sel = '[itemprop="description"], [class*="product-description" i], [class*="product__description" i], [class*="description" i], #tab-description, .woocommerce-product-details__short-description';
  const best = $(sel)
    .map((_, el) => (clean($(el).text()) ?? '').length)
    .get()
    .sort((a, b) => b - a)[0];
  return best ?? (clean($('meta[name="description" i]').attr('content'))?.length ?? 0);
}

/** Products listed on a page through structured data (ItemList / Product). */
export function listedProducts($: Doc, base: string): { url: string; name: string | null }[] {
  const out: { url: string; name: string | null }[] = [];
  for (const o of jsonLd($)) {
    if (ldTypes(o).includes('itemlist') && Array.isArray(o.itemListElement)) {
      for (const it of o.itemListElement as Record<string, unknown>[]) {
        const item = (it.item as Record<string, unknown> | undefined) ?? it;
        const url = absUrl(str(item.url) ?? str(it.url), base);
        if (url) out.push({ url, name: str(item.name) });
      }
    }
  }
  return out;
}

/** Shopify's public storefront feed: /products.json. Returns null when not available. */
export function parseShopifyProducts(json: unknown, base: string): ProductSample[] | null {
  if (!json || typeof json !== 'object' || !Array.isArray((json as { products?: unknown }).products)) return null;
  return ((json as { products: Record<string, unknown>[] }).products).map((p) => {
    const variants = (p.variants as Record<string, unknown>[] | undefined) ?? [];
    const images = (p.images as Record<string, unknown>[] | undefined) ?? [];
    const html = typeof p.body_html === 'string' ? p.body_html.replace(/<[^>]+>/g, ' ') : '';
    return {
      url: absUrl(`/products/${String(p.handle ?? '')}`, base) ?? base,
      name: str(p.title),
      image: images[0] ? str(images[0].src) : null,
      imageCount: images.length,
      price: variants[0] ? str(variants[0].price) : null,
      currency: null,
      descriptionLength: (clean(html) ?? '').length,
      availability: variants.length ? (variants.some((v) => v.available === true) ? 'InStock' : variants.every((v) => v.available === false) ? 'OutOfStock' : null) : null,
      addToCart: false,
      related: false,
      source: 'platform-json' as const,
    };
  });
}

export { classifyUrl };
