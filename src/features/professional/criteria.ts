import type { AuditReport, Params } from '@/types/audit';
import type { BusinessAnalysis, Confidence, Evidence, SiteClassification } from '@/types/business';
import type { CriterionResult, EvidenceBasis, PillarId, ProfileId } from '@/types/professional';
import { WEAK_HEADLINE } from '@/features/business/headline';

/**
 * Professionalism criteria. Each one has a rule (documented in its copy and
 * implemented here), an observable indicator, recorded evidence and a basis
 * label. A criterion that could not be checked returns "untested" and is left
 * out of the score — it is never scored as zero. A criterion that does not
 * apply returns "na".
 */

export interface Ctx {
  report: AuditReport;
  b: BusinessAnalysis;
  cl: SiteClassification | undefined;
  home: string;
  rendered: boolean;
  saudi: boolean;
  profile: ProfileId;
}

type Outcome = Pick<CriterionResult, 'status' | 'score' | 'basis' | 'confidence' | 'evidence' | 'params' | 'reason'>;

export interface CriterionDef {
  id: string;
  importance: CriterionResult['importance'];
  /** Pillar and share per profile; absent = not used in that profile. */
  in: Partial<Record<ProfileId, { pillar: PillarId; weight: number }>>;
  /** Existing recommendation/finding ids that cover the same problem (to avoid duplicates). */
  related: string[];
  run: (ctx: Ctx) => Outcome;
}

const scored = (score: number, basis: EvidenceBasis, evidence: Evidence[], params: Params = {}, confidence: Confidence = 'high'): Outcome => ({
  status: 'scored',
  score: Math.max(0, Math.min(100, Math.round(score))),
  basis,
  confidence,
  evidence,
  params,
});
const untested = (reason: string, evidence: Evidence[] = [], params: Params = {}): Outcome => ({ status: 'untested', score: null, basis: 'unverified', confidence: null, evidence, params, reason });
const na = (reason: string): Outcome => ({ status: 'na', score: null, basis: 'na', confidence: null, evidence: [], params: {}, reason });

/** Piecewise score: first band whose minimum the value reaches. */
const band = (v: number, bands: [number, number][]): number => (bands.find(([min]) => v >= min) ?? [0, 0])[1];
const share = (n: number, total: number) => (total ? n / total : 0);
const pct = (x: number) => Math.round(x * 100);

const homeEv = (c: Ctx, where: string, value?: string, screenshot?: 'desktop' | 'mobile'): Evidence => ({ url: c.home, where, ...(value !== undefined ? { value } : {}), ...(screenshot ? { screenshot } : {}) });
const analysedProducts = (c: Ctx) => (c.b.catalog?.products ?? []).filter((p) => p.source !== 'platform-json');
const pageOf = (c: Ctx, kind: string) => c.b.coverage.pages.find((p) => p.kind === kind && p.ok);

const needsRender = (c: Ctx) => (c.rendered ? null : untested('not_rendered'));

// ─── Shared criteria (both profiles) ────────────────────────────────────────

const ctaContrast: CriterionDef = {
  id: 'cta_contrast',
  importance: 'medium',
  in: { ecommerce: { pillar: 'visual', weight: 25 }, general: { pillar: 'visual', weight: 20 } },
  related: ['design_cta_low_contrast'],
  run: (c) => {
    const skip = needsRender(c);
    if (skip) return skip;
    const cta = c.b.design.primaryCta;
    if (!cta || cta.contrast === null) return untested('no_cta');
    return scored(band(cta.contrast, [[4.5, 100], [3, 75], [2, 40], [0, 15]]), 'measured', [homeEv(c, 'main button', `«${cta.text}» ${cta.contrast}:1`, 'desktop')], { text: cta.text, contrast: cta.contrast });
  },
};

const heroContrast: CriterionDef = {
  id: 'hero_contrast',
  importance: 'low',
  in: { ecommerce: { pillar: 'visual', weight: 15 }, general: { pillar: 'visual', weight: 15 } },
  related: ['design_hero_text_contrast'],
  run: (c) => {
    const skip = needsRender(c);
    if (skip) return skip;
    const h = c.b.design.heroText;
    if (!h || h.contrast === null) return untested('no_hero_text');
    return scored(band(h.contrast, [[4.5, 100], [3, 70], [2, 40], [0, 15]]), 'measured', [homeEv(c, 'main headline', `«${h.text}» ${h.contrast}:1`, 'desktop')], { text: h.text, contrast: h.contrast });
  },
};

const fontFamilies: CriterionDef = {
  id: 'font_families',
  importance: 'low',
  in: { ecommerce: { pillar: 'visual', weight: 15 }, general: { pillar: 'visual', weight: 15 } },
  related: ['design_too_many_fonts'],
  run: (c) => {
    const skip = needsRender(c);
    if (skip) return skip;
    const used = c.b.design.fonts.filter((f) => f.share >= 0.05);
    if (!used.length) return untested('no_text_measured');
    return scored(band(-used.length, [[-2, 100], [-3, 70], [-99, 40]]), 'measured', [homeEv(c, 'text on the homepage', used.map((f) => `${f.family} ${pct(f.share)}%`).join(', '), 'desktop')], { count: used.length, fonts: used.map((f) => f.family).join(', ') });
  },
};

const logo: CriterionDef = {
  id: 'logo',
  importance: 'medium',
  in: { ecommerce: { pillar: 'visual', weight: 15 }, general: { pillar: 'visual', weight: 15 } },
  related: ['brand_no_logo'],
  run: (c) => {
    const l = c.b.identity.logo;
    if (l) return scored(100, 'detected', [homeEv(c, l.source, l.url)]);
    return scored(25, 'detected', [homeEv(c, 'header, structured data and icons', 'no logo image found')], {}, 'medium');
  },
};

const bannerWeight: CriterionDef = {
  id: 'banner_weight',
  importance: 'medium',
  in: { ecommerce: { pillar: 'visual', weight: 15 }, general: { pillar: 'visual', weight: 10 } },
  related: ['banner_heavy'],
  run: (c) => {
    const sized = c.b.banners.banners.filter((x) => x.bytes !== null);
    if (!c.b.banners.count) return na('no_banners');
    if (!sized.length) return untested('banner_size_unknown');
    const light = sized.filter((x) => (x.bytes ?? 0) <= 450_000).length;
    const max = Math.max(...sized.map((x) => x.bytes ?? 0));
    const score = Math.min(100 * share(light, sized.length), max > 1_000_000 ? 50 : 100);
    return scored(score, 'measured', sized.slice(0, 3).map((x) => ({ url: x.src, where: 'homepage banner image', value: `${Math.round((x.bytes ?? 0) / 1024)} KB` })), { light, total: sized.length, maxKb: Math.round(max / 1024) });
  },
};

const bannerMobile: CriterionDef = {
  id: 'banner_mobile',
  importance: 'medium',
  in: { ecommerce: { pillar: 'visual', weight: 15 } },
  related: ['banner_no_mobile_version'],
  run: (c) => {
    const wide = c.b.banners.banners.filter((x) => (x.ratio ?? 0) >= 2);
    if (!c.b.banners.count) return na('no_banners');
    if (!wide.length) return scored(100, 'detected', [homeEv(c, 'homepage banners', 'no very wide banners')]);
    const adapted = wide.filter((x) => x.mobileVariant || x.responsive).length;
    return scored(100 * share(adapted, wide.length), 'detected', wide.slice(0, 2).map((x) => ({ url: x.src, where: 'wide banner', value: `${x.ratio}:1, ${x.mobileVariant ? 'has a phone version' : x.responsive ? 'responsive sizes' : 'same image on phones'}` })), { adapted, total: wide.length }, 'medium');
  },
};

const navSize: CriterionDef = {
  id: 'nav_size',
  importance: 'medium',
  in: { ecommerce: { pillar: 'navigation', weight: 20 }, general: { pillar: 'structure', weight: 25 } },
  related: ['design_busy_navigation', 'ux_no_navigation'],
  run: (c) => {
    const n = c.b.design.topNavItems ?? (c.b.journey.navLinks || null);
    if (!n) return untested('no_navigation_found');
    const score = n >= 4 && n <= 9 ? 100 : n <= 3 ? 65 : band(-n, [[-14, 70], [-99, 40]]);
    return scored(score, c.b.design.topNavItems !== null ? 'measured' : 'detected', [homeEv(c, 'header navigation', `${n} links`, c.b.design.topNavItems !== null ? 'desktop' : undefined)], { count: n });
  },
};

const ctaMobileFold: CriterionDef = {
  id: 'cta_mobile_fold',
  importance: 'medium',
  in: { ecommerce: { pillar: 'conversion', weight: 15 }, general: { pillar: 'conversion', weight: 20 } },
  related: ['design_cta_below_fold_mobile', 'design_no_clear_cta'],
  run: (c) => {
    const skip = needsRender(c);
    if (skip) return skip;
    const cta = c.b.design.primaryCta;
    if (!cta) return untested('no_cta');
    return scored(cta.aboveFoldMobile ? 100 : 40, 'measured', [homeEv(c, 'first phone screen (390×844)', `«${cta.text}» ${cta.aboveFoldMobile ? 'visible' : 'below the first screen'}`, 'mobile')], { text: cta.text, visible: cta.aboveFoldMobile });
  },
};

const mOverflow: CriterionDef = {
  id: 'm_overflow',
  importance: 'high',
  in: { ecommerce: { pillar: 'mobile', weight: 35 }, general: { pillar: 'mobile', weight: 35 } },
  related: ['design_mobile_overflow'],
  run: (c) => {
    const m = c.b.design.mobile;
    if (!c.rendered || !m) return untested('not_rendered');
    return scored(m.horizontalOverflow ? 10 : 100, 'measured', [homeEv(c, 'homepage at 390px width', m.horizontalOverflow ? 'page is wider than the screen' : 'fits the screen', 'mobile')], { overflow: m.horizontalOverflow });
  },
};

const mTap: CriterionDef = {
  id: 'm_tap',
  importance: 'medium',
  in: { ecommerce: { pillar: 'mobile', weight: 25 }, general: { pillar: 'mobile', weight: 25 } },
  related: ['design_small_tap_targets', 'mobile_tap_targets'],
  run: (c) => {
    const m = c.b.design.mobile;
    if (!c.rendered || !m) return untested('not_rendered');
    return scored(band(-m.smallTapTargets, [[0, 100], [-3, 75], [-8, 45], [-999, 20]]), 'measured', [homeEv(c, 'links and buttons on the first phone screens', `${m.smallTapTargets} smaller than 24px`, 'mobile')], { count: m.smallTapTargets });
  },
};

const mFont: CriterionDef = {
  id: 'm_font',
  importance: 'medium',
  in: { ecommerce: { pillar: 'mobile', weight: 25 }, general: { pillar: 'mobile', weight: 25 } },
  related: ['design_small_mobile_text', 'mobile_font_size'],
  run: (c) => {
    const size = c.b.design.sizes.mobileBody;
    if (!c.rendered || size === null) return untested('not_rendered');
    return scored(band(size, [[16, 100], [14, 75], [12, 40], [0, 15]]), 'measured', [homeEv(c, 'body text on a phone', `${size}px`, 'mobile')], { size });
  },
};

const mTiny: CriterionDef = {
  id: 'm_tiny',
  importance: 'low',
  in: { ecommerce: { pillar: 'mobile', weight: 15 }, general: { pillar: 'mobile', weight: 15 } },
  related: [],
  run: (c) => {
    const m = c.b.design.mobile;
    if (!c.rendered || !m) return untested('not_rendered');
    return scored(band(-m.tinyText, [[0, 100], [-3, 75], [-10, 45], [-9999, 20]]), 'measured', [homeEv(c, 'text on a phone', `${m.tinyText} text elements under 12px`, 'mobile')], { count: m.tinyText });
  },
};

const techScore: CriterionDef = {
  id: 'tech_score',
  importance: 'high',
  in: { ecommerce: { pillar: 'technical', weight: 100 }, general: { pillar: 'technical', weight: 100 } },
  related: [],
  run: (c) => {
    const s = c.report.overall.score;
    if (s === null) return untested('technical_unavailable');
    return scored(s, 'measured', [homeEv(c, 'Digital Health Score (technical)', `${s}/100`)], { score: s });
  },
};

const seoScore: CriterionDef = {
  id: 'seo_score',
  importance: 'medium',
  in: { ecommerce: { pillar: 'seo_trust', weight: 30 }, general: { pillar: 'seo', weight: 40 } },
  related: [],
  run: (c) => {
    const s = c.report.categories.find((x) => x.id === 'seo')?.score ?? null;
    if (s === null) return untested('technical_unavailable');
    return scored(s, 'measured', [homeEv(c, 'SEO checks (Lighthouse and page HTML)', `${s}/100`)], { score: s });
  },
};

const privacy: CriterionDef = {
  id: 'privacy',
  importance: 'medium',
  in: { ecommerce: { pillar: 'seo_trust', weight: 15 }, general: { pillar: 'trust', weight: 15 } },
  related: [],
  run: (c) => {
    const found = c.b.journey.privacyPolicy;
    const page = c.b.coverage.pages.find((p) => p.kind === 'policy' && p.ok);
    return scored(found ? 100 : 30, 'detected', [found ? { url: page?.url ?? c.home, where: page ? 'policy page' : 'page links and text', value: 'privacy policy found' } : homeEv(c, `${c.b.coverage.pagesAnalyzed} pages read`, 'no privacy policy link or text found')], {}, found ? 'high' : 'medium');
  },
};

const channels = (c: Ctx) => {
  const ct = c.b.identity.contact;
  return (['phone', 'email', 'whatsapp', 'form', 'contactPage'] as const).filter((k) => ct[k]);
};

const contactChannels: CriterionDef = {
  id: 'contact_channels',
  importance: 'medium',
  in: { ecommerce: { pillar: 'seo_trust', weight: 15 }, general: { pillar: 'conversion', weight: 25 } },
  related: ['journey_no_instant_contact', 'ux_no_contact'],
  run: (c) => {
    const list = channels(c);
    return scored(band(list.length, [[3, 100], [2, 75], [1, 45], [0, 10]]), 'detected', [homeEv(c, 'links and forms on the pages read', list.join(', ') || 'none')], { count: list.length, channels: list.join(', ') }, 'medium');
  },
};

const registration: CriterionDef = {
  id: 'registration',
  importance: 'medium',
  in: { ecommerce: { pillar: 'seo_trust', weight: 20 }, general: { pillar: 'trust', weight: 10 } },
  related: ['journey_no_trust_details'],
  run: (c) => {
    if (!c.saudi) return na('not_saudi');
    const t = c.b.journey.trust;
    const found = (Object.keys(t) as (keyof typeof t)[]).filter((k) => t[k]);
    return scored(found.length ? 100 : 30, 'detected', [homeEv(c, 'footer and pages read', found.join(', ') || 'no Maroof, CR, VAT or Business Center reference')], { found: found.join(', ') }, found.length ? 'high' : 'medium');
  },
};

const https: CriterionDef = {
  id: 'https',
  importance: 'high',
  in: { ecommerce: { pillar: 'seo_trust', weight: 20 } },
  related: ['sec_no_https', 'sec_no_redirect'],
  run: (c) => scored(c.report.site.https ? 100 : 0, 'measured', [homeEv(c, 'final address', c.report.site.finalUrl)]),
};

// ─── E-commerce criteria ────────────────────────────────────────────────────

const homeProducts: CriterionDef = {
  id: 'home_products',
  importance: 'high',
  in: { ecommerce: { pillar: 'merchandising', weight: 30 } },
  related: [],
  run: (c) => {
    const html = c.cl?.signals.homepageProducts ?? 0;
    const cards = c.rendered ? c.b.design.productCardRatios.length : 0;
    const n = Math.max(html, cards);
    if (!n && !c.rendered) return untested('not_rendered', [homeEv(c, 'homepage HTML', 'no product links in the server HTML')]);
    return scored(band(n, [[8, 100], [4, 75], [1, 45], [0, 10]]), cards > html ? 'measured' : 'detected', [homeEv(c, 'homepage product links / cards', `${n}`, cards > html ? 'desktop' : undefined)], { count: n });
  },
};

const categories: CriterionDef = {
  id: 'categories',
  importance: 'medium',
  in: { ecommerce: { pillar: 'merchandising', weight: 25 } },
  related: ['catalog_no_categories'],
  run: (c) => {
    const cat = c.b.catalog?.categories;
    if (!cat) return untested('no_catalog');
    if (!cat.count) {
      // Category URLs are only recognised reliably on known platforms.
      if (c.b.platform.id === 'unknown') return untested('categories_unrecognised');
      return scored(15, 'detected', [homeEv(c, 'homepage and category links', 'no category links found')], { count: 0 }, 'medium');
    }
    return scored(band(cat.count, [[3, 100], [2, 70], [1, 40]]), 'detected', [homeEv(c, 'category links', cat.names.slice(0, 6).join('، '))], { count: cat.count });
  },
};

const priceListing: CriterionDef = {
  id: 'price_listing',
  importance: 'high',
  in: { ecommerce: { pillar: 'merchandising', weight: 30 } },
  related: ['product_price_missing'],
  run: (c) => {
    const ps = c.b.catalog?.products ?? [];
    if (!ps.length) return untested('no_products_read');
    const withPrice = ps.filter((p) => p.price).length;
    const missing = ps.find((p) => !p.price);
    return scored(100 * share(withPrice, ps.length), 'detected', [missing ? { url: missing.url, where: 'product', value: `${missing.name ?? ''} — no price found` } : homeEv(c, 'products read', `${withPrice}/${ps.length} with a price`)], { withPrice, total: ps.length });
  },
};

const cardConsistency: CriterionDef = {
  id: 'card_consistency',
  importance: 'low',
  in: { ecommerce: { pillar: 'merchandising', weight: 15 } },
  related: ['design_inconsistent_cards'],
  run: (c) => {
    const r = c.b.design.productCardRatios;
    if (!c.rendered) return untested('not_rendered');
    if (r.length < 3) return untested('few_cards');
    const spread = Math.max(...r) / Math.min(...r);
    return scored(spread <= 1.05 ? 100 : spread <= 1.15 ? 75 : 40, 'measured', [homeEv(c, 'product card images on the homepage', `${r.length} cards, ratios ${Math.min(...r)}–${Math.max(...r)}`, 'desktop')], { count: r.length, min: Math.min(...r), max: Math.max(...r) });
  },
};

const ppMetric = (id: string, importance: CriterionDef['importance'], weight: number, related: string[], fn: (ps: ReturnType<typeof analysedProducts>) => { score: number; ev: Evidence; params: Params }): CriterionDef => ({
  id,
  importance,
  in: { ecommerce: { pillar: 'product_page', weight } },
  related,
  run: (c) => {
    const ps = analysedProducts(c);
    if (!ps.length) return untested('no_product_pages');
    const r = fn(ps);
    return scored(r.score, 'detected', [r.ev], { ...r.params, pages: ps.length }, ps.length >= 3 ? 'high' : 'medium');
  },
});

const ppImages = ppMetric('pp_images', 'high', 20, ['product_few_images'], (ps) => {
  const avg = ps.reduce((n, p) => n + p.imageCount, 0) / ps.length;
  const worst = [...ps].sort((a, b) => a.imageCount - b.imageCount)[0];
  return { score: band(avg, [[4, 100], [3, 85], [2, 60], [0, 30]]), ev: { url: worst.url, where: 'product gallery', value: `${worst.name ?? ''}: ${worst.imageCount} image(s); average ${avg.toFixed(1)}` }, params: { avg: Number(avg.toFixed(1)) } };
});
const ppDescription = ppMetric('pp_description', 'medium', 20, ['product_short_description'], (ps) => {
  const avg = ps.reduce((n, p) => n + p.descriptionLength, 0) / ps.length;
  const worst = [...ps].sort((a, b) => a.descriptionLength - b.descriptionLength)[0];
  return { score: band(avg, [[300, 100], [120, 70], [40, 40], [0, 15]]), ev: { url: worst.url, where: 'product description', value: `${worst.name ?? ''}: ${worst.descriptionLength} chars; average ${Math.round(avg)}` }, params: { avg: Math.round(avg) } };
});
const ppAddToCart = ppMetric('pp_add_to_cart', 'high', 20, ['product_no_add_to_cart'], (ps) => {
  const n = ps.filter((p) => p.addToCart).length;
  const miss = ps.find((p) => !p.addToCart);
  return { score: 100 * share(n, ps.length), ev: { url: (miss ?? ps[0]).url, where: 'product page', value: `${n}/${ps.length} with an add-to-cart control` }, params: { n } };
});
const ppPrice = ppMetric('pp_price', 'high', 20, ['product_price_missing'], (ps) => {
  const n = ps.filter((p) => p.price).length;
  const miss = ps.find((p) => !p.price);
  return { score: 100 * share(n, ps.length), ev: { url: (miss ?? ps[0]).url, where: 'product page', value: `${n}/${ps.length} show a price` }, params: { n } };
});
const ppAvailability = ppMetric('pp_availability', 'low', 10, ['product_no_availability'], (ps) => {
  const n = ps.filter((p) => p.availability).length;
  return { score: 100 * share(n, ps.length), ev: { url: ps[0].url, where: 'product page', value: `${n}/${ps.length} state availability` }, params: { n } };
});
const ppRelated = ppMetric('pp_related', 'low', 10, ['product_no_related'], (ps) => {
  const n = ps.filter((p) => p.related).length;
  return { score: n ? 100 : 40, ev: { url: ps[0].url, where: 'product page', value: `${n}/${ps.length} show related products` }, params: { n } };
});

const searchPresent: CriterionDef = {
  id: 'search_present',
  importance: 'high',
  in: { ecommerce: { pillar: 'navigation', weight: 25 } },
  related: ['search_missing'],
  run: (c) => {
    const s = c.b.search;
    if (s.present) return scored(100, s.source === 'rendered' ? 'measured' : 'detected', [homeEv(c, s.source === 'html' ? 'page HTML' : s.source === 'component' ? 'platform search component' : 'rendered page', s.placeholder ?? 'search field')]);
    // A search field added by JavaScript can only be ruled out on the rendered page.
    if (!c.rendered) return untested('not_rendered', [homeEv(c, 'page HTML', 'no search field in the server HTML')]);
    return scored(20, 'measured', [homeEv(c, 'rendered homepage (desktop and phone)', 'no search field', 'desktop')]);
  },
};

const searchWorks: CriterionDef = {
  id: 'search_works',
  importance: 'high',
  in: { ecommerce: { pillar: 'navigation', weight: 25 } },
  related: ['search_misses_products', 'search_irrelevant'],
  run: (c) => {
    const t = c.b.search.tests.find((x) => x.kind === 'representative');
    if (!t) return untested(c.b.search.present ? 'search_no_query' : 'no_search');
    if (t.status !== 'ok') return untested(`search_${t.status}`, t.url ? [{ url: t.url, where: 'search results', value: t.query }] : []);
    const score = !t.resultCount ? 10 : t.relevantCount === 0 ? 30 : 100;
    return scored(score, 'measured', [{ url: t.url ?? c.home, where: 'search results', value: `"${t.query}": ${t.resultCount} results, ${t.relevantCount ?? '?'} relevant` }], { query: t.query, results: t.resultCount ?? 0, relevant: t.relevantCount ?? 0 });
  },
};

const searchEmpty: CriterionDef = {
  id: 'search_empty_state',
  importance: 'low',
  in: { ecommerce: { pillar: 'navigation', weight: 15 } },
  related: ['search_no_empty_state'],
  run: (c) => {
    const t = c.b.search.tests.find((x) => x.kind === 'no_result');
    if (!t || t.status !== 'ok') return untested(t ? `search_${t.status}` : 'no_search');
    if ((t.resultCount ?? 0) > 0) return untested('search_returned_results');
    return scored(t.noResultMessage ? 100 : 40, 'measured', [{ url: t.url ?? c.home, where: 'search results', value: `"${t.query}": ${t.noResultMessage ? 'shows a no-results message' : 'empty page without a message'}` }], { query: t.query });
  },
};

const searchMobile: CriterionDef = {
  id: 'search_mobile',
  importance: 'medium',
  in: { ecommerce: { pillar: 'navigation', weight: 15 } },
  related: ['search_hidden_mobile'],
  run: (c) => {
    const s = c.b.search;
    if (!s.present) return na('no_search');
    if (s.visibleMobile === null) return untested('not_rendered');
    return scored(s.visibleMobile ? 100 : 45, 'measured', [homeEv(c, 'first phone screen', s.visibleMobile ? 'search visible' : 'search hidden behind a menu', 'mobile')]);
  },
};

const cartVisible: CriterionDef = {
  id: 'cart_visible',
  importance: 'high',
  in: { ecommerce: { pillar: 'conversion', weight: 20 } },
  related: [],
  run: (c) => scored(c.b.journey.cartLink ? 100 : 30, 'detected', [homeEv(c, 'header and links', c.b.journey.cartLink ? 'cart link found' : 'no cart link found')], {}, 'medium'),
};

const presence = (id: string, importance: CriterionDef['importance'], pillarWeight: number, related: string[], key: 'deliveryInfo' | 'returnPolicy' | 'reviews', lowScore: number): CriterionDef => ({
  id,
  importance,
  in: { ecommerce: { pillar: 'conversion', weight: pillarWeight } },
  related,
  run: (c) => {
    const found = c.b.journey[key];
    return scored(found ? 100 : lowScore, 'detected', [homeEv(c, `${c.b.coverage.pagesAnalyzed} pages read`, found ? 'found' : 'not found in the pages read')], {}, found ? 'high' : 'medium');
  },
});

const paymentsShown: CriterionDef = {
  id: 'payments_shown',
  importance: 'medium',
  in: { ecommerce: { pillar: 'conversion', weight: 20 } },
  related: ['journey_no_payment_info'],
  run: (c) => {
    const m = c.b.journey.paymentMethods;
    return scored(band(m.length, [[3, 100], [2, 80], [1, 60], [0, 25]]), 'detected', [homeEv(c, 'logos, text and footer of the pages read', m.join(', ') || 'none shown')], { count: m.length, methods: m.join(', ') }, m.length ? 'high' : 'medium');
  },
};

// ─── General-website criteria ───────────────────────────────────────────────

const pagePresence = (id: string, kind: 'about' | 'contact', pillar: PillarId, weight: number): CriterionDef => ({
  id,
  importance: 'medium',
  in: { general: { pillar, weight } },
  related: [],
  run: (c) => {
    const p = pageOf(c, kind);
    if (p) return scored(100, 'detected', [{ url: p.url, where: `${kind} page`, value: 'opened successfully' }]);
    const linked = kind === 'contact' ? c.b.identity.contact.contactPage : false;
    return scored(linked ? 70 : 35, 'detected', [homeEv(c, 'homepage links', linked ? 'linked but could not be opened' : `no ${kind} page link found`)], {}, 'medium');
  },
});

const brokenPages: CriterionDef = {
  id: 'broken_pages',
  importance: 'medium',
  in: { general: { pillar: 'structure', weight: 25 } },
  related: [],
  run: (c) => {
    const tried = c.b.coverage.pages.filter((p) => p.status !== null);
    const broken = tried.filter((p) => (p.status ?? 0) >= 400);
    if (tried.length < 2) return untested('few_pages');
    return scored(band(-broken.length, [[0, 100], [-1, 60], [-99, 30]]), 'measured', broken.length ? broken.slice(0, 3).map((p) => ({ url: p.url, where: 'linked page', value: `HTTP ${p.status}` })) : [homeEv(c, 'linked pages opened', `${tried.length} pages, none broken`)], { broken: broken.length, total: tried.length });
  },
};

const homeImagery: CriterionDef = {
  id: 'home_imagery',
  importance: 'medium',
  in: { general: { pillar: 'visual', weight: 25 } },
  related: [],
  run: (c) => {
    const op = c.report.site.onPage;
    if (!op || op.likelyClientRendered) return untested(op ? 'client_rendered' : 'no_html');
    return scored(band(op.imageCount, [[4, 100], [2, 70], [1, 40], [0, 20]]), 'detected', [homeEv(c, 'homepage <img> elements', `${op.imageCount}`)], { count: op.imageCount }, 'medium');
  },
};

const pageSections: CriterionDef = {
  id: 'page_sections',
  importance: 'low',
  in: { general: { pillar: 'content', weight: 10 } },
  related: ['seo_heading_order'],
  run: (c) => {
    const op = c.report.site.onPage;
    if (!op || op.likelyClientRendered) return untested(op ? 'client_rendered' : 'no_html');
    return scored(band(op.headingCount, [[6, 100], [4, 75], [2, 50], [0, 25]]), 'measured', [homeEv(c, 'homepage headings (h1–h6)', `${op.headingCount}`)], { count: op.headingCount });
  },
};

const valueProposition: CriterionDef = {
  id: 'value_proposition',
  importance: 'high',
  in: { general: { pillar: 'content', weight: 20 } },
  related: [],
  run: (c) => {
    const hero = c.cl?.signals.hero;
    const op = c.report.site.onPage;
    if (!hero || !op) return untested('no_classification');
    if (op.likelyClientRendered) return untested('client_rendered');
    const h = hero.headline;
    if (!h) return scored(20, 'detected', [homeEv(c, 'homepage <h1>', 'no main headline')], { headline: null });
    const words = h.split(/\s+/).filter(Boolean).length;
    const weak = WEAK_HEADLINE.test(h) || words < 3 || (c.cl?.signals.genericPhrases ?? []).some((g) => h.includes(g));
    const score = weak ? 30 : hero.support ? 100 : 65;
    return scored(score, 'detected', [homeEv(c, 'homepage <h1> and the text under it', `«${h}»${hero.support ? ' + supporting sentence' : ''}`)], { headline: h, support: hero.support, weak }, 'medium');
  },
};

const proofElements: CriterionDef = {
  id: 'proof_elements',
  importance: 'medium',
  in: { general: { pillar: 'trust', weight: 30 } },
  related: [],
  run: (c) => {
    const proof = c.cl?.signals.proof;
    if (!proof) return untested('no_classification');
    const kinds = [...new Set(proof.map((p) => p.kind))];
    return scored(band(kinds.length, [[3, 100], [2, 80], [1, 55], [0, 30]]), 'detected', proof.length ? proof.map((p) => ({ url: p.url, where: `proof: ${p.kind}`, value: p.value })) : [homeEv(c, `${c.b.coverage.pagesAnalyzed} pages read`, 'no numbers, client list, case studies or team found')], { count: kinds.length, kinds: kinds.join(', ') }, 'medium');
  },
};

const homeWords: CriterionDef = {
  id: 'home_words',
  importance: 'medium',
  in: { general: { pillar: 'content', weight: 40 } },
  related: ['ux_thin_content'],
  run: (c) => {
    const op = c.report.site.onPage;
    if (!op || op.likelyClientRendered) return untested(op ? 'client_rendered' : 'no_html');
    return scored(band(op.wordCount, [[300, 100], [150, 75], [60, 45], [0, 20]]), 'measured', [homeEv(c, 'homepage text', `${op.wordCount} words`)], { words: op.wordCount });
  },
};

const genericPhrases: CriterionDef = {
  id: 'generic_phrases',
  importance: 'low',
  in: { general: { pillar: 'content', weight: 10 } },
  related: [],
  run: (c) => {
    if (!c.cl) return untested('no_classification');
    const g = c.cl.signals.genericPhrases;
    return scored(band(-g.length, [[0, 100], [-1, 75], [-2, 55], [-99, 35]]), 'detected', g.length ? g.map((p) => homeEv(c, 'homepage text', `"${p}"`)) : [homeEv(c, 'homepage headings and paragraphs', 'no stock phrases found')], { count: g.length, phrases: g.join('، ') }, 'medium');
  },
};

const servicesDescribed: CriterionDef = {
  id: 'services_described',
  importance: 'medium',
  in: { general: { pillar: 'content', weight: 20 } },
  related: [],
  run: (c) => {
    if (!c.cl) return untested('no_classification');
    const s = c.cl.services;
    // Not finding service names in the HTML does not prove they are missing.
    if (!s.length) return untested('services_not_found');
    return scored(s.length >= 3 ? 100 : 70, 'detected', [homeEv(c, s[0].source, s.map((x) => x.name).join('، '))], { count: s.length }, 'medium');
  },
};

const primaryCta: CriterionDef = {
  id: 'primary_cta',
  importance: 'high',
  in: { general: { pillar: 'conversion', weight: 20 } },
  related: ['design_no_clear_cta', 'ux_no_cta'],
  run: (c) => {
    if (c.rendered) {
      const cta = c.b.design.primaryCta;
      return scored(cta ? 100 : 25, 'measured', [homeEv(c, 'homepage buttons', cta ? `«${cta.text}»` : 'no clear call to action', 'desktop')], { text: cta?.text ?? null });
    }
    const op = c.report.site.onPage;
    if (!op || op.likelyClientRendered) return untested('not_rendered');
    return scored(op.ctaCount ? 100 : 30, 'detected', [homeEv(c, 'homepage HTML', op.ctaSamples.join(' · ') || 'no action wording found')], { count: op.ctaCount }, 'medium');
  },
};

const actionOnHome: CriterionDef = {
  id: 'action_on_home',
  importance: 'medium',
  in: { general: { pillar: 'conversion', weight: 15 } },
  related: [],
  run: (c) => {
    const conv = c.cl?.conversion;
    if (!c.cl?.model.primary) return untested('no_model');
    if (!conv || !conv.label) return scored(30, 'detected', [homeEv(c, 'links and buttons on the pages read', `no button for the main action (${c.cl.model.primary})`)], { model: c.cl.model.primary }, 'medium');
    const onHome = conv.evidence.some((e) => e.url === c.home);
    return scored(onHome ? 100 : 60, 'detected', conv.evidence.slice(0, 1), { label: conv.label, model: c.cl.model.primary, onHome });
  },
};

const instantContact: CriterionDef = {
  id: 'instant_contact',
  importance: 'medium',
  in: { general: { pillar: 'conversion', weight: 20 } },
  related: ['journey_no_instant_contact', 'ux_no_whatsapp'],
  run: (c) => {
    if (!c.saudi) return na('not_saudi');
    const ct = c.b.identity.contact;
    return scored(ct.whatsapp ? 100 : ct.phone ? 75 : 30, 'detected', [homeEv(c, 'links on the pages read', ct.whatsapp ? 'WhatsApp link' : ct.phone ? 'phone link only' : 'no WhatsApp or phone link')], {}, 'medium');
  },
};

const structuredData: CriterionDef = {
  id: 'structured_data',
  importance: 'low',
  in: { general: { pillar: 'seo', weight: 20 } },
  related: [],
  run: (c) => {
    if (!c.cl) return untested('no_classification');
    const useful = c.cl.signals.ldTypes.filter((t) => /organization|business|service|restaurant|store|legal|medical|dentist|physician|realestate|software|travel|lodging|school|website/.test(t));
    return scored(useful.length ? 100 : 40, 'detected', [homeEv(c, 'JSON-LD', useful.join(', ') || 'no organisation / business markup')], { types: useful.join(', ') });
  },
};

const openGraph: CriterionDef = {
  id: 'open_graph',
  importance: 'low',
  in: { general: { pillar: 'seo', weight: 20 } },
  related: [],
  run: (c) => {
    if (!c.cl) return untested('no_classification');
    return scored(c.cl.signals.openGraph ? 100 : 50, 'detected', [homeEv(c, 'og:title / og:image', c.cl.signals.openGraph ? 'present' : 'missing')]);
  },
};

const sitemap: CriterionDef = {
  id: 'sitemap',
  importance: 'low',
  in: { general: { pillar: 'seo', weight: 20 } },
  related: [],
  run: (c) => scored(c.b.coverage.sitemap.found ? 100 : 50, 'detected', [homeEv(c, 'robots.txt and /sitemap.xml', c.b.coverage.sitemap.found ? `${c.b.coverage.sitemap.urls} URLs` : 'not found')]),
};

const businessAddress: CriterionDef = {
  id: 'business_address',
  importance: 'low',
  in: { general: { pillar: 'trust', weight: 10 } },
  related: [],
  run: (c) => {
    if (!c.cl) return untested('no_classification');
    const s = c.cl.signals;
    const found = s.address || s.mapEmbed;
    return scored(found ? 100 : 45, 'detected', [homeEv(c, 'address element, structured data and map links', found ? [s.address && 'address', s.mapEmbed && 'map'].filter(Boolean).join(' + ') : 'not found')], {}, found ? 'high' : 'medium');
  },
};

const socialLinks: CriterionDef = {
  id: 'social_links',
  importance: 'low',
  in: { general: { pillar: 'trust', weight: 10 } },
  related: [],
  run: (c) => {
    const s = c.b.identity.contact.social;
    return scored(s.length ? 100 : 50, 'detected', [homeEv(c, 'links', s.join(', ') || 'none')], { count: s.length });
  },
};

const testimonials: CriterionDef = {
  id: 'testimonials',
  importance: 'low',
  in: { general: { pillar: 'trust', weight: 25 } },
  related: ['journey_no_reviews'],
  run: (c) => scored(c.b.journey.reviews ? 100 : 45, 'detected', [homeEv(c, `${c.b.coverage.pagesAnalyzed} pages read`, c.b.journey.reviews ? 'reviews / testimonials found' : 'none found')], {}, 'medium'),
};

export const CRITERIA: CriterionDef[] = [
  // merchandising
  homeProducts,
  categories,
  priceListing,
  cardConsistency,
  // visual
  ctaContrast,
  heroContrast,
  fontFamilies,
  logo,
  bannerWeight,
  bannerMobile,
  homeImagery,
  // product page
  ppImages,
  ppDescription,
  ppAddToCart,
  ppPrice,
  ppAvailability,
  ppRelated,
  // navigation / structure
  searchPresent,
  searchWorks,
  searchEmpty,
  searchMobile,
  navSize,
  pagePresence('about_page', 'about', 'structure', 25),
  pagePresence('contact_page', 'contact', 'structure', 25),
  brokenPages,
  // content
  pageSections,
  valueProposition,
  homeWords,
  genericPhrases,
  servicesDescribed,
  // conversion
  cartVisible,
  paymentsShown,
  presence('delivery_info', 'medium', 15, ['journey_no_delivery_info'], 'deliveryInfo', 25),
  presence('return_policy', 'medium', 15, ['journey_no_return_policy'], 'returnPolicy', 25),
  presence('reviews', 'low', 15, ['journey_no_reviews'], 'reviews', 45),
  ctaMobileFold,
  primaryCta,
  contactChannels,
  actionOnHome,
  instantContact,
  // mobile
  mOverflow,
  mTap,
  mFont,
  mTiny,
  // technical
  techScore,
  // seo & trust
  seoScore,
  structuredData,
  openGraph,
  sitemap,
  privacy,
  registration,
  https,
  businessAddress,
  socialLinks,
  testimonials,
  proofElements,
];
