import { z } from 'zod';

/**
 * The PDF endpoint receives the report back from the browser, so its shape
 * and sizes are checked before anything is rendered. (All text is also
 * escaped by the template.)
 */
const text = (max: number) => z.string().max(max);
const score = z.number().min(0).max(100).nullable();
const params = z.record(text(40), z.union([text(500), z.number(), z.boolean(), z.null()]));
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
});

export const pdfRequestSchema = z.object({ report: reportSchema, locale: z.enum(['ar', 'en']) });
