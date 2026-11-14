import { z } from 'zod';

/**
 * The PDF endpoint receives the report back from the browser, so its shape
 * and sizes are checked before anything is rendered. (All text is also
 * escaped by the template.)
 */
const text = (max: number) => z.string().max(max);
const score = z.number().min(0).max(100).nullable();
const params = z.record(text(40), z.union([text(2100), z.number(), z.boolean(), z.null()]));
const basis = z.enum(['verified', 'inferred']);
const category = z.enum(['performance', 'mobile', 'seo', 'security', 'accessibility', 'ux']);
const reason = z.enum(['psi_unavailable', 'site_unreachable', 'client_rendered', 'not_applicable', 'not_reported']);

const auditRef = z.object({
  id: text(80),
  title: text(200),
  score: z.number().nullable(),
  displayValue: text(160).optional(),
  items: z.number().optional(),
});
const metric = z.object({ value: z.number().nullable(), score: z.number().nullable() });
const fieldMetric = z.object({ p75: z.number(), category: text(20) });

const strategyData = z.object({
  strategy: z.enum(['mobile', 'desktop']),
  lighthouseVersion: text(20).nullable(),
  scores: z.object({ performance: score, accessibility: score, seo: score, bestPractices: score }),
  metrics: z.object({ fcp: metric, lcp: metric, si: metric, tbt: metric, cls: metric }),
  audits: z.record(text(80), auditRef),
  a11yFailures: z.array(auditRef).max(20),
  seoFailures: z.array(auditRef).max(20),
  field: z
    .object({
      origin: z.boolean(),
      overall: text(20).nullable(),
      lcp: fieldMetric.optional(),
      inp: fieldMetric.optional(),
      cls: fieldMetric.optional(),
    })
    .nullable(),
});

const psiOutcome = z.union([
  z.object({ ok: z.literal(true), data: strategyData }),
  z.object({
    ok: z.literal(false),
    error: z.enum(['quota', 'invalid_key', 'lighthouse_failed', 'timeout', 'network', 'unknown']),
    detail: text(80).optional(),
  }),
]);

const onPage = z.object({
  title: text(220).nullable(),
  metaDescription: text(420).nullable(),
  canonical: text(320).nullable(),
  robotsMeta: text(180).nullable(),
  lang: text(40).nullable(),
  viewport: text(180).nullable(),
  h1Count: z.number(),
  headingCount: z.number(),
  headingOrderOk: z.boolean(),
  wordCount: z.number(),
  imageCount: z.number(),
  imagesMissingAlt: z.number(),
  navLinkCount: z.number(),
  hasNavLandmark: z.boolean(),
  headerLinkCount: z.number(),
  contact: z.object({ tel: z.boolean(), email: z.boolean(), whatsapp: z.boolean(), contactLink: z.boolean(), form: z.boolean() }),
  ctaCount: z.number(),
  ctaSamples: z.array(text(60)).max(5),
  mixedContentCount: z.number(),
  mixedContentSamples: z.array(text(140)).max(5),
  scriptCount: z.number(),
  likelyClientRendered: z.boolean(),
});

/* Business analysis. Identifiers are checked by shape; the template looks
 * them up in its own dictionaries and escapes everything it prints. */
const slug = z.string().regex(/^[a-z_]{1,32}$/);
const conf = z.enum(['high', 'medium', 'low']);
const url = text(2100);
const evidence = z.array(text(300)).max(16);
const detected = z.object({ value: slug, confidence: conf, evidence });
/** Only small raster images inlined by our own scanner are accepted. */
const imageData = (max: number) => z.string().max(max).regex(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/);

const business = z.object({
  version: z.literal(1),
  identity: z.object({
    brandName: z.object({ value: text(200), source: text(40) }).nullable(),
    siteTitle: text(300).nullable(),
    description: text(600).nullable(),
    logo: z.object({ url, source: text(40), dataUri: imageData(240_000).optional() }).nullable(),
    colors: z.array(z.object({ hex: z.string().regex(/^#[0-9a-f]{6}$/i), source: z.enum(['theme-color', 'css', 'rendered']), weight: z.number() })).max(12),
    websiteType: detected,
    industry: detected.nullable(),
    language: z.object({ primary: text(20).nullable(), declared: text(40).nullable(), arabicShare: z.number().nullable() }),
    country: z.object({ code: text(4), evidence }).nullable(),
    contact: z.object({ phone: z.boolean(), email: z.boolean(), whatsapp: z.boolean(), contactPage: z.boolean(), form: z.boolean(), social: z.array(text(30)).max(12) }),
  }),
  platform: z.object({ id: slug, confidence: conf.nullable(), evidence, frameworks: z.array(text(40)).max(8) }),
  coverage: z.object({
    pagesAnalyzed: z.number(),
    requests: z.number(),
    robots: z.enum(['found', 'missing', 'error']),
    robotsBlocked: z.number(),
    sitemap: z.object({ found: z.boolean(), files: z.number(), urls: z.number(), productUrls: z.number(), categoryUrls: z.number() }),
    pages: z.array(z.object({ url, kind: slug, status: z.number().nullable(), ok: z.boolean() })).max(40),
    budgetReached: z.boolean(),
    durationMs: z.number(),
  }),
  catalog: z
    .object({
      productUrlsDiscovered: z.number(),
      productPagesAnalyzed: z.number(),
      catalogTotal: z.object({ value: z.number(), verified: z.boolean(), source: z.enum(['shopify-products-json', 'sitemap']) }).nullable(),
      products: z
        .array(
          z.object({
            url,
            name: text(300).nullable(),
            image: url.nullable(),
            imageCount: z.number(),
            price: text(40).nullable(),
            currency: text(10).nullable(),
            descriptionLength: z.number(),
            availability: text(60).nullable(),
            addToCart: z.boolean(),
            related: z.boolean(),
            source: z.enum(['json-ld', 'microdata', 'open-graph', 'html', 'platform-json']),
          }),
        )
        .max(20),
      categories: z.object({ count: z.number(), names: z.array(text(120)).max(40) }),
    })
    .nullable(),
  banners: z.object({
    count: z.number(),
    sliders: z.number(),
    banners: z
      .array(
        z.object({
          src: url,
          alt: text(300).nullable(),
          width: z.number().nullable(),
          height: z.number().nullable(),
          ratio: z.number().nullable(),
          bytes: z.number().nullable(),
          format: text(20).nullable(),
          responsive: z.boolean(),
          mobileVariant: z.boolean(),
          inSlider: z.boolean(),
          linked: z.boolean(),
          measured: z.boolean(),
        }),
      )
      .max(12),
  }),
  search: z.object({
    present: z.boolean(),
    source: z.enum(['html', 'component', 'rendered']).nullable(),
    action: url.nullable(),
    inputName: text(80).nullable(),
    placeholder: text(200).nullable(),
    visibleDesktop: z.boolean().nullable(),
    visibleMobile: z.boolean().nullable(),
    autocomplete: z.boolean().nullable(),
    tests: z
      .array(
        z.object({
          query: text(120),
          kind: z.enum(['representative', 'no_result']),
          status: z.enum(['ok', 'failed', 'blocked_by_robots', 'skipped']),
          resultCount: z.number().nullable(),
          relevantCount: z.number().nullable(),
          noResultMessage: z.boolean().nullable(),
          url: url.nullable(),
          via: z.enum(['http', 'browser']),
        }),
      )
      .max(6),
  }),
  journey: z.object({
    cartLink: z.boolean(),
    accountLink: z.boolean(),
    paymentMethods: z.array(text(40)).max(20),
    deliveryInfo: z.boolean(),
    returnPolicy: z.boolean(),
    privacyPolicy: z.boolean(),
    trust: z.object({ maroof: z.boolean(), commercialRegistration: z.boolean(), vatNumber: z.boolean(), businessCenter: z.boolean() }),
    reviews: z.boolean(),
    navLinks: z.number(),
  }),
  design: z.object({
    rendered: z.boolean(),
    screenshots: z.object({ desktop: imageData(1_600_000).nullable(), mobile: imageData(1_600_000).nullable() }),
    fonts: z.array(z.object({ family: text(80), share: z.number() })).max(8),
    sizes: z.object({ h1: z.number().nullable(), h2: z.number().nullable(), body: z.number().nullable(), mobileBody: z.number().nullable() }),
    palette: z.array(z.string().regex(/^#[0-9a-f]{6}$/i)).max(12),
    primaryCta: z.object({ text: text(120), contrast: z.number().nullable(), aboveFoldDesktop: z.boolean(), aboveFoldMobile: z.boolean() }).nullable(),
    mobile: z.object({ horizontalOverflow: z.boolean(), smallTapTargets: z.number(), tinyText: z.number() }).nullable(),
    heroText: z.object({ text: text(300), contrast: z.number().nullable() }).nullable(),
    productCardRatios: z.array(z.number()).max(20),
    topNavItems: z.number().nullable(),
    notes: z.array(text(200)).max(20),
  }),
  recommendations: z
    .array(
      z.object({
        id: text(60),
        group: z.enum(['critical', 'high', 'design', 'conversion', 'seo', 'longterm']),
        priority: z.enum(['critical', 'high', 'medium', 'low', 'info']),
        complexity: z.enum(['low', 'medium', 'high']),
        basis,
        params,
      }),
    )
    .max(60),
  limits: z.array(text(40)).max(20),
});

export const reportSchema = z.object({
  version: z.literal(1),
  id: text(60),
  requestedUrl: text(2100),
  finalUrl: text(2100),
  host: text(260),
  generatedAt: z.iso.datetime(),
  durationMs: z.number(),
  overall: z.object({
    score,
    grade: z.enum(['excellent', 'good', 'needs_improvement', 'weak', 'critical']).nullable(),
    coveredWeight: z.number().min(0).max(100),
  }),
  categories: z
    .array(
      z.object({
        id: category,
        weight: z.number(),
        score,
        status: z.enum(['complete', 'partial', 'unavailable']),
        coverage: z.number(),
        checks: z
          .array(z.object({ id: text(40), weight: z.number(), score, basis, reason: reason.optional(), params }))
          .max(20),
      }),
    )
    .max(6),
  psi: z.object({ mobile: psiOutcome, desktop: psiOutcome }),
  site: z.object({
    ok: z.boolean(),
    error: z.enum(['timeout', 'dns_failed', 'connection_failed', 'tls_error', 'too_many_redirects', 'http_error', 'not_html']).optional(),
    errorDetail: text(120).optional(),
    requestedUrl: text(2100),
    finalUrl: text(2100),
    status: z.number().nullable(),
    redirectCount: z.number(),
    https: z.boolean(),
    httpRedirectsToHttps: z.boolean().nullable(),
    ttfbMs: z.number().nullable(),
    headers: z.record(text(60), text(320)),
    onPage: onPage.nullable(),
  }),
  findings: z.array(z.object({ id: text(40), category, severity: z.enum(['critical', 'high', 'medium', 'low', 'info']), basis, params })).max(80),
  strengths: z.array(z.object({ id: text(40), category, params })).max(20),
  ai: z.object({ en: text(1300), ar: text(1300), model: text(60) }).nullable(),
  business: business.nullable().optional(),
});

export const pdfRequestSchema = z.object({ report: reportSchema, locale: z.enum(['ar', 'en']) });
