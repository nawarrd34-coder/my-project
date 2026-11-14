import type { AuditRef, FieldData, MetricId, PsiOutcome, StrategyData } from '@/types/audit';

type Json = Record<string, unknown>;

const METRIC_AUDITS: Record<MetricId, string> = {
  fcp: 'first-contentful-paint',
  lcp: 'largest-contentful-paint',
  si: 'speed-index',
  tbt: 'total-blocking-time',
  cls: 'cumulative-layout-shift',
};

/**
 * Audits the rules engine reads. Lighthouse renames audits between major
 * versions (v13 replaced many with "-insight" audits), so both generations
 * are listed and whichever exists in the response is kept.
 */
export const TRACKED_AUDITS = [
  // mobile experience
  'viewport', 'viewport-insight', 'target-size', 'tap-targets', 'font-size', 'content-width',
  // loading opportunities
  'render-blocking-resources', 'render-blocking-insight',
  'modern-image-formats', 'uses-optimized-images', 'uses-responsive-images', 'offscreen-images',
  'image-delivery-insight',
  'unused-javascript', 'unused-css-rules', 'unminified-javascript', 'unminified-css',
  'legacy-javascript', 'legacy-javascript-insight', 'duplicated-javascript-insight',
  'server-response-time', 'document-latency-insight',
  'uses-long-cache-ttl', 'cache-insight', 'uses-text-compression',
  // seo
  'document-title', 'meta-description', 'canonical', 'is-crawlable', 'robots-txt', 'link-text',
  'crawlable-anchors', 'hreflang', 'http-status-code',
  // best practices / security
  'is-on-https', 'redirects-http', 'errors-in-console',
  // accessibility audits also surfaced in other sections
  'image-alt',
];

const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const pct = (v: unknown): number | null => {
  const n = num(v);
  return n === null ? null : Math.round(n * 100);
};

function toRef(id: string, audit: Json): AuditRef {
  const details = isObj(audit.details) ? audit.details : null;
  const items = details && Array.isArray(details.items) ? details.items.length : undefined;
  const ref: AuditRef = {
    id,
    title: String(audit.title ?? id).slice(0, 160),
    score: num(audit.score),
  };
  if (typeof audit.displayValue === 'string') ref.displayValue = audit.displayValue.slice(0, 120);
  if (items !== undefined) ref.items = items;
  return ref;
}

/** A failing audit is one Lighthouse scored (not informative/n-a) below a pass. */
function failed(audit: Json): boolean {
  const mode = String(audit.scoreDisplayMode ?? '');
  if (mode === 'notApplicable' || mode === 'informative' || mode === 'manual' || mode === 'error') return false;
  const score = num(audit.score);
  return score !== null && score < 0.9;
}

function failuresIn(category: unknown, audits: Json, limit: number): AuditRef[] {
  if (!isObj(category) || !Array.isArray(category.auditRefs)) return [];
  const out: AuditRef[] = [];
  for (const ref of category.auditRefs) {
    if (!isObj(ref) || typeof ref.id !== 'string') continue;
    const audit = audits[ref.id];
    if (isObj(audit) && failed(audit)) out.push(toRef(ref.id, audit));
    if (out.length >= limit) break;
  }
  return out;
}

function parseField(json: Json): FieldData | null {
  const page = isObj(json.loadingExperience) ? json.loadingExperience : null;
  const origin = isObj(json.originLoadingExperience) ? json.originLoadingExperience : null;
  const usePage = page && isObj(page.metrics) && !page.origin_fallback;
  const src = usePage ? page : origin && isObj(origin.metrics) ? origin : null;
  if (!src || !isObj(src.metrics)) return null;
  const metrics = src.metrics;
  const read = (key: string) => {
    const m = metrics[key];
    if (!isObj(m)) return undefined;
    const p75 = num(m.percentile);
    if (p75 === null) return undefined;
    return { p75, category: String(m.category ?? '') };
  };
  const field: FieldData = {
    origin: !usePage,
    overall: typeof src.overall_category === 'string' ? src.overall_category : null,
    lcp: read('LARGEST_CONTENTFUL_PAINT_MS'),
    inp: read('INTERACTION_TO_NEXT_PAINT'),
    cls: read('CUMULATIVE_LAYOUT_SHIFT_SCORE'),
  };
  if (!field.lcp && !field.inp && !field.cls) return null;
  // CrUX reports CLS multiplied by 100.
  if (field.cls) field.cls = { ...field.cls, p75: field.cls.p75 / 100 };
  return field;
}

/** Turn a PageSpeed Insights v5 response into the compact shape the app stores. */
export function parsePageSpeed(json: unknown): PsiOutcome {
  if (!isObj(json) || !isObj(json.lighthouseResult)) return { ok: false, error: 'unknown', detail: 'no_lighthouse_result' };
  const lhr = json.lighthouseResult;
  if (isObj(lhr.runtimeError) && lhr.runtimeError.code && lhr.runtimeError.code !== 'NO_ERROR') {
    return { ok: false, error: 'lighthouse_failed', detail: String(lhr.runtimeError.code) };
  }
  const audits = isObj(lhr.audits) ? lhr.audits : {};
  const categories = isObj(lhr.categories) ? lhr.categories : {};
  const catScore = (id: string) => (isObj(categories[id]) ? pct((categories[id] as Json).score) : null);

  const metrics = {} as StrategyData['metrics'];
  for (const [id, auditId] of Object.entries(METRIC_AUDITS) as [MetricId, string][]) {
    const audit = audits[auditId];
    metrics[id] = isObj(audit)
      ? { value: num(audit.numericValue), score: num(audit.score) }
      : { value: null, score: null };
  }

  const tracked: Record<string, AuditRef> = {};
  for (const id of TRACKED_AUDITS) {
    const audit = audits[id];
    if (!isObj(audit)) continue;
    const mode = String(audit.scoreDisplayMode ?? '');
    if (mode === 'notApplicable' || mode === 'manual' || mode === 'error') continue;
    tracked[id] = toRef(id, audit);
  }

  const config = isObj(lhr.configSettings) ? lhr.configSettings : {};
  const data: StrategyData = {
    strategy: config.formFactor === 'desktop' ? 'desktop' : 'mobile',
    lighthouseVersion: typeof lhr.lighthouseVersion === 'string' ? lhr.lighthouseVersion : null,
    scores: {
      performance: catScore('performance'),
      accessibility: catScore('accessibility'),
      seo: catScore('seo'),
      bestPractices: catScore('best-practices'),
    },
    metrics,
    audits: tracked,
    a11yFailures: failuresIn(categories.accessibility, audits, 10),
    seoFailures: failuresIn(categories.seo, audits, 8),
    field: parseField(json),
  };

  if (Object.values(data.scores).every((s) => s === null)) {
    return { ok: false, error: 'lighthouse_failed', detail: 'no_scores' };
  }
  return { ok: true, data };
}
