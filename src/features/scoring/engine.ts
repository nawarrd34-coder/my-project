import type {
  CategoryId,
  CategoryResult,
  CheckResult,
  Grade,
  NotTestedReason,
  Params,
  PsiOutcome,
  SiteProbe,
  StrategyData,
} from '@/types/audit';

/**
 * SCORING METHODOLOGY
 *
 * 1. Each category is made of checks. A check has a share of its category
 *    (shares sum to 100) and produces 0–100 from measured data, or null when
 *    it could not be completed.
 * 2. Category score = weighted average of the checks that produced data.
 *    Missing checks are left out of the average — they are never scored as 0
 *    and never filled with a guess.
 * 3. A category needs at least MIN_CATEGORY_COVERAGE of its shares to be
 *    scored. Below that it is "unavailable".
 * 4. Overall score = weighted average of the available categories using the
 *    weights below, re-normalised to 100. It is only shown when categories
 *    worth at least MIN_OVERALL_WEIGHT points produced a score.
 */
export const CATEGORY_WEIGHTS: Record<CategoryId, number> = {
  performance: 25,
  mobile: 20,
  seo: 20,
  security: 15,
  accessibility: 10,
  ux: 10,
};

export const CATEGORY_ORDER: CategoryId[] = ['performance', 'mobile', 'seo', 'security', 'accessibility', 'ux'];

export const MIN_CATEGORY_COVERAGE = 0.4;
export const MIN_OVERALL_WEIGHT = 60;

/** Lab thresholds published by Google for "good" / "poor" (web.dev/vitals). */
export const THRESHOLDS = {
  lcp: { good: 2500, poor: 4000 },
  fcp: { good: 1800, poor: 3000 },
  si: { good: 3400, poor: 5800 },
  tbt: { good: 200, poor: 600 },
  cls: { good: 0.1, poor: 0.25 },
} as const;

/** Product-defined assessment bands (not an external standard). */
export function gradeFor(score: number): Grade {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'needs_improvement';
  if (score >= 40) return 'weak';
  return 'critical';
}

/** True when a robots directive tells search engines not to index the page. */
export function isNoindex(directive: string): boolean {
  return directive
    .toLowerCase()
    .split(/[,\s]+/)
    .some((token) => token === 'noindex' || token === 'none' || /^[a-z-]*bot[a-z-]*:(noindex|none)$/.test(token));
}

export interface ScoringInput {
  site: SiteProbe;
  mobile: PsiOutcome;
  desktop: PsiOutcome;
}

const check = (
  id: string,
  weight: number,
  score: number | null,
  params: Params = {},
  basis: CheckResult['basis'] = 'verified',
  reason?: NotTestedReason,
): CheckResult => ({ id, weight, score, basis, params, ...(score === null && reason ? { reason } : {}) });

const missing = (id: string, weight: number, reason: NotTestedReason, basis: CheckResult['basis'] = 'verified') =>
  check(id, weight, null, {}, basis, reason);

const data = (o: PsiOutcome): StrategyData | null => (o.ok ? o.data : null);
const has = (v: string | undefined) => (v ? 100 : 0);

function auditScore(d: StrategyData | null, ids: string[]): { score: number | null; id: string | null } {
  if (!d) return { score: null, id: null };
  for (const id of ids) {
    const a = d.audits[id];
    if (a && a.score !== null) return { score: a.score >= 0.9 ? 100 : 0, id };
  }
  return { score: null, id: null };
}

function performance(m: StrategyData | null, d: StrategyData | null): CheckResult[] {
  return [
    m?.scores.performance != null
      ? check('perf_mobile', 60, m.scores.performance, { score: m.scores.performance })
      : missing('perf_mobile', 60, 'psi_unavailable'),
    d?.scores.performance != null
      ? check('perf_desktop', 40, d.scores.performance, { score: d.scores.performance })
      : missing('perf_desktop', 40, 'psi_unavailable'),
  ];
}

function mobile(m: StrategyData | null, site: SiteProbe): CheckResult[] {
  const checks: CheckResult[] = [];
  checks.push(
    m?.scores.performance != null
      ? check('mobile_perf', 50, m.scores.performance, { score: m.scores.performance })
      : missing('mobile_perf', 50, 'psi_unavailable'),
  );

  // Viewport: prefer our own reading of the HTML, fall back to Lighthouse.
  const vp = site.onPage?.viewport;
  if (site.onPage && !site.onPage.likelyClientRendered) {
    const ok = !!vp && /width\s*=\s*device-width/i.test(vp);
    checks.push(check('mobile_viewport', 20, ok ? 100 : vp ? 40 : 0, { viewport: vp ?? null }));
  } else {
    const lh = auditScore(m, ['viewport', 'viewport-insight']);
    checks.push(
      lh.score !== null
        ? check('mobile_viewport', 20, lh.score, { viewport: null, source: 'lighthouse' })
        : missing('mobile_viewport', 20, m ? 'not_reported' : 'psi_unavailable'),
    );
  }

  if (m) {
    const lab: [keyof typeof THRESHOLDS, number | null][] = [
      ['lcp', m.metrics.lcp.value],
      ['cls', m.metrics.cls.value],
      ['tbt', m.metrics.tbt.value],
    ];
    const measured = lab.filter(([, v]) => v !== null);
    if (measured.length) {
      const passed = measured.filter(([k, v]) => (v as number) <= THRESHOLDS[k].good).length;
      checks.push(
        check('mobile_vitals', 20, Math.round((passed / measured.length) * 100), {
          passed,
          measured: measured.length,
        }),
      );
    } else checks.push(missing('mobile_vitals', 20, 'not_reported'));

    const tap = auditScore(m, ['target-size', 'tap-targets']);
    const font = auditScore(m, ['font-size']);
    const parts = [tap.score, font.score].filter((s): s is number => s !== null);
    checks.push(
      parts.length
        ? check('mobile_touch_text', 10, Math.round(parts.reduce((a, b) => a + b, 0) / parts.length), {
            tap: tap.score,
            font: font.score,
          })
        : missing('mobile_touch_text', 10, 'not_reported'),
    );
  } else {
    checks.push(missing('mobile_vitals', 20, 'psi_unavailable'), missing('mobile_touch_text', 10, 'psi_unavailable'));
  }
  return checks;
}

function seo(m: StrategyData | null, d: StrategyData | null, site: SiteProbe): CheckResult[] {
  const lhSeo = m?.scores.seo ?? d?.scores.seo ?? null;
  const checks: CheckResult[] = [
    lhSeo !== null
      ? check('seo_lighthouse', 50, lhSeo, { score: lhSeo, source: m?.scores.seo != null ? 'mobile' : 'desktop' })
      : missing('seo_lighthouse', 50, 'psi_unavailable'),
  ];

  const p = site.onPage;
  const reason: NotTestedReason = !p ? 'site_unreachable' : 'client_rendered';
  if (!p || p.likelyClientRendered) {
    for (const [id, w] of [
      ['seo_title', 10],
      ['seo_description', 10],
      ['seo_indexable', 10],
      ['seo_h1', 10],
      ['seo_canonical', 5],
      ['seo_lang', 5],
    ] as const) {
      checks.push(missing(id, w, reason));
    }
    return checks;
  }

  const tl = p.title?.length ?? 0;
  checks.push(check('seo_title', 10, !p.title ? 0 : tl >= 10 && tl <= 65 ? 100 : 60, { length: tl }));
  const dl = p.metaDescription?.length ?? 0;
  checks.push(check('seo_description', 10, !p.metaDescription ? 0 : dl >= 50 && dl <= 165 ? 100 : 60, { length: dl }));
  const robots = `${p.robotsMeta ?? ''} ${site.headers['x-robots-tag'] ?? ''}`;
  const noindex = isNoindex(robots);
  checks.push(check('seo_indexable', 10, noindex ? 0 : 100, { directive: robots.trim() || null }));
  checks.push(check('seo_h1', 10, p.h1Count === 1 ? 100 : p.h1Count > 1 ? 60 : 0, { count: p.h1Count }));
  checks.push(check('seo_canonical', 5, p.canonical ? 100 : 0, { canonical: p.canonical }));
  checks.push(check('seo_lang', 5, p.lang ? 100 : 0, { lang: p.lang }));
  return checks;
}

function security(m: StrategyData | null, d: StrategyData | null, site: SiteProbe): CheckResult[] {
  // A TLS failure is a verified result: the certificate was rejected.
  const tlsBroken = site.error === 'tls_error';
  const reached = site.status !== null;
  if (!reached && !tlsBroken) {
    return (
      [
        ['sec_https', 40],
        ['sec_redirect', 10],
        ['sec_hsts', 10],
        ['sec_csp', 10],
        ['sec_mixed', 10],
        ['sec_xcto', 5],
        ['sec_frame', 5],
        ['sec_referrer', 5],
        ['sec_permissions', 5],
      ] as const
    ).map(([id, w]) => missing(id, w, 'site_unreachable'));
  }

  const h = site.headers;
  const csp = h['content-security-policy'];
  const checks: CheckResult[] = [
    check('sec_https', 40, site.https && !tlsBroken ? 100 : 0, { https: site.https, tls: tlsBroken ? (site.errorDetail ?? 'invalid') : 'ok' }),
  ];
  if (tlsBroken) {
    for (const [id, w] of [
      ['sec_redirect', 10],
      ['sec_hsts', 10],
      ['sec_csp', 10],
      ['sec_mixed', 10],
      ['sec_xcto', 5],
      ['sec_frame', 5],
      ['sec_referrer', 5],
      ['sec_permissions', 5],
    ] as const) {
      checks.push(missing(id, w, 'site_unreachable'));
    }
    return checks;
  }

  checks.push(
    site.httpRedirectsToHttps === null
      ? missing('sec_redirect', 10, 'not_reported')
      : check('sec_redirect', 10, site.httpRedirectsToHttps ? 100 : 0),
    check('sec_hsts', 10, site.https ? has(h['strict-transport-security']) : 0, { value: h['strict-transport-security'] ?? null }),
    check('sec_csp', 10, has(csp), { reportOnly: !csp && !!h['content-security-policy-report-only'] }),
  );

  // Mixed content only exists on HTTPS pages.
  if (!site.https) checks.push(missing('sec_mixed', 10, 'not_applicable'));
  else {
    const lh = (m ?? d)?.audits['is-on-https'];
    const lhInsecure = lh && lh.score !== null && lh.score < 1 ? (lh.items ?? 1) : 0;
    const htmlCount = site.onPage?.mixedContentCount ?? 0;
    if (!site.onPage && !lh) checks.push(missing('sec_mixed', 10, 'not_reported'));
    else checks.push(check('sec_mixed', 10, htmlCount + lhInsecure > 0 ? 0 : 100, { html: htmlCount, lighthouse: lhInsecure }));
  }

  checks.push(
    check('sec_xcto', 5, /nosniff/i.test(h['x-content-type-options'] ?? '') ? 100 : 0),
    check('sec_frame', 5, h['x-frame-options'] || /frame-ancestors/i.test(csp ?? '') ? 100 : 0),
    check('sec_referrer', 5, has(h['referrer-policy']), { value: h['referrer-policy'] ?? null }),
    check('sec_permissions', 5, has(h['permissions-policy'])),
  );
  return checks;
}

function accessibility(m: StrategyData | null, d: StrategyData | null): CheckResult[] {
  const score = m?.scores.accessibility ?? d?.scores.accessibility ?? null;
  return [
    score !== null
      ? check('a11y_lighthouse', 100, score, { score, source: m?.scores.accessibility != null ? 'mobile' : 'desktop' })
      : missing('a11y_lighthouse', 100, 'psi_unavailable'),
  ];
}

/** User-experience indicators are heuristics over the HTML — always "inferred". */
function ux(site: SiteProbe): CheckResult[] {
  const ids = ['ux_navigation', 'ux_contact', 'ux_cta', 'ux_structure'];
  const p = site.onPage;
  if (!p) return ids.map((id) => missing(id, 25, 'site_unreachable', 'inferred'));
  if (p.likelyClientRendered) return ids.map((id) => missing(id, 25, 'client_rendered', 'inferred'));

  const nav = p.hasNavLandmark && p.navLinkCount >= 3 ? 100 : p.navLinkCount + p.headerLinkCount >= 3 ? 60 : 0;
  const channels = [p.contact.tel, p.contact.email, p.contact.whatsapp, p.contact.contactLink, p.contact.form].filter(Boolean).length;
  const structure = (p.h1Count >= 1 ? 40 : 0) + (p.headingCount >= 3 ? 30 : 0) + (p.wordCount >= 150 ? 30 : 0);
  return [
    check('ux_navigation', 25, nav, { links: p.navLinkCount, landmark: p.hasNavLandmark }, 'inferred'),
    check('ux_contact', 25, channels >= 2 ? 100 : channels === 1 ? 70 : 0, { channels }, 'inferred'),
    check('ux_cta', 25, p.ctaCount > 0 ? 100 : 0, { count: p.ctaCount, sample: p.ctaSamples[0] ?? null }, 'inferred'),
    check('ux_structure', 25, structure, { words: p.wordCount, headings: p.headingCount, h1: p.h1Count }, 'inferred'),
  ];
}

function summarize(id: CategoryId, checks: CheckResult[]): CategoryResult {
  const scored = checks.filter((c) => c.score !== null);
  // "Not applicable" checks are removed from the denominator, not counted as gaps.
  const applicable = checks.filter((c) => c.reason !== 'not_applicable');
  const total = applicable.reduce((s, c) => s + c.weight, 0);
  const got = scored.reduce((s, c) => s + c.weight, 0);
  const coverage = total ? got / total : 0;
  if (!scored.length || coverage < MIN_CATEGORY_COVERAGE) {
    return { id, weight: CATEGORY_WEIGHTS[id], score: null, status: 'unavailable', coverage, checks };
  }
  const score = Math.round(scored.reduce((s, c) => s + c.weight * (c.score as number), 0) / got);
  return { id, weight: CATEGORY_WEIGHTS[id], score, status: coverage >= 0.999 ? 'complete' : 'partial', coverage, checks };
}

export function scoreAudit(input: ScoringInput): {
  categories: CategoryResult[];
  overall: { score: number | null; grade: Grade | null; coveredWeight: number };
} {
  const m = data(input.mobile);
  const d = data(input.desktop);
  const categories: CategoryResult[] = [
    summarize('performance', performance(m, d)),
    summarize('mobile', mobile(m, input.site)),
    summarize('seo', seo(m, d, input.site)),
    summarize('security', security(m, d, input.site)),
    summarize('accessibility', accessibility(m, d)),
    summarize('ux', ux(input.site)),
  ];

  const available = categories.filter((c) => c.score !== null);
  const coveredWeight = available.reduce((s, c) => s + c.weight, 0);
  if (coveredWeight < MIN_OVERALL_WEIGHT) {
    return { categories, overall: { score: null, grade: null, coveredWeight } };
  }
  const score = Math.round(available.reduce((s, c) => s + c.weight * (c.score as number), 0) / coveredWeight);
  return { categories, overall: { score, grade: gradeFor(score), coveredWeight } };
}
