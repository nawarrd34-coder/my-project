import type { Finding, Params, Severity } from '@/types/audit';
import type { BusinessAnalysis, BusinessRecommendation, Complexity, RecGroup } from '@/types/business';
import { STORE_PLATFORMS } from './platform';

/**
 * Business recommendation rules. Each rule fires only on something observed
 * in this scan and records the observation in `params`, which the report shows
 * as evidence. Subjective design advice is marked "inferred".
 */
const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
const GROUP_RANK: Record<RecGroup, number> = { critical: 0, high: 1, conversion: 2, design: 3, seo: 4, longterm: 5 };

export function businessRecommendations(a: BusinessAnalysis): BusinessRecommendation[] {
  const out: BusinessRecommendation[] = [];
  const add = (id: string, group: RecGroup, priority: Severity, complexity: Complexity, params: Params = {}, basis: 'verified' | 'inferred' = 'verified') =>
    out.push({ id, group, priority, complexity, basis, params });

  const isStore = a.identity.websiteType.value === 'ecommerce' || STORE_PLATFORMS.includes(a.platform.id);
  const products = a.catalog?.products ?? [];
  const analysedPages = products.filter((p) => p.source !== 'platform-json');
  const n = analysedPages.length;

  // ── Product pages ───────────────────────────────────────────────────────
  if (n > 0) {
    const noCart = analysedPages.filter((p) => !p.addToCart);
    if (noCart.length === n) add('product_no_add_to_cart', 'critical', 'high', 'medium', { pages: n, example: noCart[0].url }, 'inferred');
    const noPrice = analysedPages.filter((p) => !p.price);
    if (noPrice.length) add('product_price_missing', 'high', noPrice.length === n ? 'high' : 'medium', 'low', { count: noPrice.length, total: n, example: noPrice[0].url }, 'inferred');
    const fewImages = analysedPages.filter((p) => p.imageCount <= 1);
    if (fewImages.length) add('product_few_images', 'conversion', 'medium', 'medium', { count: fewImages.length, total: n, example: fewImages[0].name ?? fewImages[0].url });
    const shortDesc = analysedPages.filter((p) => p.descriptionLength < 120);
    if (shortDesc.length) add('product_short_description', 'seo', 'medium', 'medium', { count: shortDesc.length, total: n, example: shortDesc[0].name ?? shortDesc[0].url, length: shortDesc[0].descriptionLength });
    const noStock = analysedPages.filter((p) => !p.availability);
    if (noStock.length === n) add('product_no_availability', 'conversion', 'low', 'low', { total: n });
    if (analysedPages.every((p) => !p.related)) add('product_no_related', 'conversion', 'low', 'medium', { total: n }, 'inferred');
    const noSchema = analysedPages.filter((p) => p.source !== 'json-ld');
    if (noSchema.length) add('product_no_structured_data', 'seo', 'medium', 'low', { count: noSchema.length, total: n });
  }

  // ── Catalogue ───────────────────────────────────────────────────────────
  if (isStore && a.catalog && a.catalog.categories.count === 0 && a.catalog.productUrlsDiscovered > 12) {
    add('catalog_no_categories', 'conversion', 'medium', 'medium', { products: a.catalog.productUrlsDiscovered }, 'inferred');
  }

  // ── Search ──────────────────────────────────────────────────────────────
  const rep = a.search.tests.find((t) => t.kind === 'representative' && t.status === 'ok');
  const none = a.search.tests.find((t) => t.kind === 'no_result' && t.status === 'ok');
  const catalogSize = a.catalog?.catalogTotal?.value ?? a.catalog?.productUrlsDiscovered ?? 0;
  if (isStore && !a.search.present && catalogSize >= 12) add('search_missing', 'high', 'high', 'medium', { products: catalogSize }, a.design.rendered ? 'verified' : 'inferred');
  if (rep && rep.resultCount === 0) add('search_misses_products', 'high', 'high', 'medium', { query: rep.query });
  else if (rep && rep.resultCount && rep.relevantCount === 0) add('search_irrelevant', 'high', 'medium', 'medium', { query: rep.query, results: rep.resultCount });
  if (none && !none.noResultMessage && (none.resultCount ?? 0) === 0) add('search_no_empty_state', 'conversion', 'low', 'low', { query: none.query });
  if (a.search.present && a.search.visibleMobile === false) add('search_hidden_mobile', 'conversion', 'medium', 'low', {});
  if (isStore && a.search.present && a.search.autocomplete === false && rep) add('search_no_autocomplete', 'longterm', 'low', 'medium', { query: rep.query });

  // ── Banners ─────────────────────────────────────────────────────────────
  const heavy = a.banners.banners.filter((b) => (b.bytes ?? 0) > 450_000);
  if (heavy.length) add('banner_heavy', 'high', 'medium', 'low', { count: heavy.length, largestKb: Math.round(Math.max(...heavy.map((b) => b.bytes ?? 0)) / 1024), example: heavy[0].src });
  const wide = a.banners.banners.filter((b) => b.inSlider && (b.ratio ?? 0) >= 2.4 && !b.mobileVariant);
  if (wide.length) add('banner_no_mobile_version', 'design', 'medium', 'medium', { count: wide.length, ratio: wide[0].ratio ?? 0, example: wide[0].src }, 'inferred');
  const lowRes = a.banners.banners.filter((b) => b.measured && b.inSlider && (b.width ?? 9999) < 1200 && (b.ratio ?? 0) >= 1.8);
  if (lowRes.length) add('banner_low_resolution', 'design', 'medium', 'low', { count: lowRes.length, width: lowRes[0].width ?? 0, example: lowRes[0].src });
  const ratios = a.banners.banners.filter((b) => b.inSlider && b.ratio).map((b) => b.ratio as number);
  if (ratios.length >= 2 && Math.max(...ratios) / Math.min(...ratios) > 1.15) add('banner_mixed_ratios', 'design', 'low', 'low', { min: Math.min(...ratios), max: Math.max(...ratios) });
  const noAlt = a.banners.banners.filter((b) => !b.alt);
  if (noAlt.length) add('banner_missing_alt', 'seo', 'low', 'low', { count: noAlt.length, total: a.banners.count });
  if (a.banners.banners.length && a.banners.banners.every((b) => !b.linked)) add('banner_not_clickable', 'conversion', 'low', 'low', { total: a.banners.count }, 'inferred');

  // ── Design (rendered) ───────────────────────────────────────────────────
  const d = a.design;
  if (d.rendered) {
    if (d.mobile?.horizontalOverflow) add('design_mobile_overflow', 'critical', 'high', 'medium', {});
    if (d.primaryCta && d.primaryCta.contrast !== null && d.primaryCta.contrast < 3) add('design_cta_low_contrast', 'design', 'medium', 'low', { text: d.primaryCta.text, contrast: d.primaryCta.contrast });
    if (d.primaryCta && !d.primaryCta.aboveFoldMobile) add('design_cta_below_fold_mobile', 'conversion', 'medium', 'low', { text: d.primaryCta.text });
    if (!d.primaryCta) add('design_no_clear_cta', 'conversion', 'medium', 'low', {}, 'inferred');
    if (d.sizes.mobileBody !== null && d.sizes.mobileBody < 14) add('design_small_mobile_text', 'design', 'medium', 'low', { size: d.sizes.mobileBody });
    if ((d.mobile?.smallTapTargets ?? 0) >= 8) add('design_small_tap_targets', 'design', 'medium', 'medium', { count: d.mobile!.smallTapTargets });
    if (d.fonts.length > 3 && d.fonts[3].share >= 0.05) add('design_too_many_fonts', 'design', 'low', 'medium', { fonts: d.fonts.map((f) => f.family).slice(0, 5).join(', ') }, 'inferred');
    if (d.heroText && d.heroText.contrast !== null && d.heroText.contrast < 4.5) add('design_hero_text_contrast', 'design', 'medium', 'low', { text: d.heroText.text, contrast: d.heroText.contrast });
    if (d.notes.includes('hero_text_over_image')) add('design_hero_text_over_image', 'design', 'low', 'low', { text: d.heroText?.text ?? '' }, 'inferred');
    if (d.productCardRatios.length >= 4) {
      const max = Math.max(...d.productCardRatios);
      const min = Math.min(...d.productCardRatios);
      if (max / min > 1.15) add('design_inconsistent_cards', 'design', 'low', 'medium', { min, max });
    }
    if ((d.topNavItems ?? 0) > 9) add('design_busy_navigation', 'design', 'low', 'medium', { items: d.topNavItems ?? 0 }, 'inferred');
  }
  if (!a.identity.logo) add('brand_no_logo', 'design', 'medium', 'low', {}, 'inferred');

  // ── Customer journey ────────────────────────────────────────────────────
  const j = a.journey;
  if (isStore) {
    if (!j.paymentMethods.length) add('journey_no_payment_info', 'conversion', 'medium', 'low', {}, 'inferred');
    if (!j.deliveryInfo) add('journey_no_delivery_info', 'conversion', 'medium', 'low', {}, 'inferred');
    if (!j.returnPolicy) add('journey_no_return_policy', 'high', 'medium', 'low', {}, 'inferred');
    const saudi = a.identity.country?.code === 'SA';
    const t = j.trust;
    if (saudi && !t.maroof && !t.commercialRegistration && !t.businessCenter) add('journey_no_trust_details', 'conversion', 'medium', 'low', {}, 'inferred');
    if (!j.reviews) add('journey_no_reviews', 'longterm', 'low', 'medium', {}, 'inferred');
  }
  if (!a.identity.contact.whatsapp && !a.identity.contact.phone && a.identity.country?.code === 'SA') add('journey_no_instant_contact', 'conversion', 'medium', 'low', {}, 'inferred');

  // ── Long term ───────────────────────────────────────────────────────────
  const hasBlog = a.coverage.pages.some((p) => p.kind === 'blog');
  if (isStore && !hasBlog && catalogSize >= 20) add('longterm_content', 'longterm', 'low', 'high', {}, 'inferred');
  if (a.identity.language.primary === 'ar' && a.identity.country?.code === 'SA' && !/en/i.test(a.identity.language.declared ?? '') && isStore) {
    add('longterm_bilingual', 'longterm', 'info', 'high', {}, 'inferred');
  }

  return out.sort((x, y) => GROUP_RANK[x.group] - GROUP_RANK[y.group] || SEVERITY_RANK[x.priority] - SEVERITY_RANK[y.priority]);
}

/** Where technical findings sit in the business recommendation groups. */
export function groupForFinding(f: Finding): RecGroup {
  if (f.severity === 'critical') return 'critical';
  if (f.category === 'seo') return 'seo';
  if (f.category === 'ux') return 'conversion';
  if (f.category === 'accessibility') return 'design';
  if (f.severity === 'high') return 'high';
  if (f.severity === 'medium') return f.category === 'performance' || f.category === 'mobile' ? 'high' : 'longterm';
  return 'longterm';
}

const COMPLEXITY: Record<string, Complexity> = {
  sec_csp_missing: 'medium',
  perf_unused_code: 'high',
  perf_server_response: 'high',
  perf_tbt: 'high',
  perf_render_blocking: 'medium',
  perf_images: 'low',
  perf_lcp: 'medium',
  mobile_viewport_missing: 'low',
  sec_no_https: 'low',
  seo_title_missing: 'low',
  seo_description_missing: 'low',
};

export const complexityForFinding = (f: Finding): Complexity => COMPLEXITY[f.id] ?? (f.category === 'security' || f.category === 'seo' ? 'low' : 'medium');
