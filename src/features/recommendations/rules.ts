import { isNoindex, THRESHOLDS } from '@/features/scoring/engine';
import type {
  CategoryId,
  Finding,
  Params,
  PsiOutcome,
  Severity,
  SiteProbe,
  StrategyData,
  Strength,
} from '@/types/audit';

/**
 * Deterministic rules engine. Every finding is produced from a value that was
 * actually measured in this audit, and carries that value in `params` so the
 * report can show its evidence. No finding is created without data behind it.
 */
export interface RulesInput {
  site: SiteProbe;
  mobile: PsiOutcome;
  desktop: PsiOutcome;
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

/** Lighthouse audits grouped by the recommendation they lead to. */
const OPPORTUNITY_GROUPS: Record<string, string[]> = {
  perf_render_blocking: ['render-blocking-resources', 'render-blocking-insight'],
  perf_images: ['modern-image-formats', 'uses-optimized-images', 'uses-responsive-images', 'offscreen-images', 'image-delivery-insight'],
  perf_unused_code: ['unused-javascript', 'unused-css-rules', 'unminified-javascript', 'unminified-css', 'legacy-javascript', 'legacy-javascript-insight', 'duplicated-javascript-insight'],
  perf_server_response: ['server-response-time', 'document-latency-insight'],
  perf_caching: ['uses-long-cache-ttl', 'cache-insight'],
  perf_compression: ['uses-text-compression'],
};

const ok = (o: PsiOutcome): StrategyData | null => (o.ok ? o.data : null);

export function buildFindings(input: RulesInput): { findings: Finding[]; strengths: Strength[] } {
  const { site } = input;
  const m = ok(input.mobile);
  const d = ok(input.desktop);
  const lab = m ?? d; // the lab run findings are based on
  const labName = m ? 'mobile' : 'desktop';
  const findings: Finding[] = [];
  const strengths: Strength[] = [];

  const add = (id: string, category: CategoryId, severity: Severity, params: Params = {}, basis: Finding['basis'] = 'verified') =>
    findings.push({ id, category, severity, basis, params });
  const good = (id: string, category: CategoryId, params: Params = {}) => strengths.push({ id, category, params });

  /* ───────── Performance ───────── */
  if (lab) {
    const perf = lab.scores.performance;
    if (perf !== null) {
      if (perf < 50) add('perf_score_low', 'performance', 'high', { score: perf, strategy: labName });
      else if (perf < 90) add('perf_score_medium', 'performance', 'medium', { score: perf, strategy: labName });
      else good('strength_performance', 'performance', { score: perf, strategy: labName });
    }
    const { lcp, tbt, cls, fcp, si } = lab.metrics;
    const band = (v: number, t: { good: number; poor: number }) => (v > t.poor ? 'poor' : v > t.good ? 'mid' : 'good');

    if (lcp.value !== null && band(lcp.value, THRESHOLDS.lcp) !== 'good') {
      add('perf_lcp', 'performance', band(lcp.value, THRESHOLDS.lcp) === 'poor' ? 'high' : 'medium', { value: lcp.value, strategy: labName });
    }
    if (tbt.value !== null && band(tbt.value, THRESHOLDS.tbt) !== 'good') {
      add('perf_tbt', 'performance', band(tbt.value, THRESHOLDS.tbt) === 'poor' ? 'high' : 'medium', { value: tbt.value, strategy: labName });
    }
    if (cls.value !== null && band(cls.value, THRESHOLDS.cls) !== 'good') {
      add('perf_cls', 'performance', band(cls.value, THRESHOLDS.cls) === 'poor' ? 'high' : 'medium', { value: cls.value, strategy: labName });
    }
    if (fcp.value !== null && band(fcp.value, THRESHOLDS.fcp) !== 'good') {
      add('perf_fcp', 'performance', band(fcp.value, THRESHOLDS.fcp) === 'poor' ? 'medium' : 'low', { value: fcp.value, strategy: labName });
    }
    if (si.value !== null && band(si.value, THRESHOLDS.si) !== 'good') {
      add('perf_si', 'performance', band(si.value, THRESHOLDS.si) === 'poor' ? 'medium' : 'low', { value: si.value, strategy: labName });
    }

    for (const [id, auditIds] of Object.entries(OPPORTUNITY_GROUPS)) {
      const hits = auditIds.map((a) => lab.audits[a]).filter((a) => a && a.score !== null && a.score < 0.9);
      if (!hits.length) continue;
      add(id, 'performance', id === 'perf_compression' || id === 'perf_caching' ? 'low' : 'medium', {
        audits: hits.map((a) => (a.displayValue ? `${a.title} (${a.displayValue})` : a.title)).slice(0, 3).join(' · '),
        strategy: labName,
      });
    }
  }

  /* ───────── Mobile experience ───────── */
  const p = site.onPage && !site.onPage.likelyClientRendered ? site.onPage : null;
  if (p) {
    if (!p.viewport) add('mobile_viewport_missing', 'mobile', 'critical');
    else if (!/width\s*=\s*device-width/i.test(p.viewport)) add('mobile_viewport_fixed', 'mobile', 'high', { viewport: p.viewport });
    else good('strength_viewport', 'mobile');
  } else if (m) {
    const vp = m.audits.viewport ?? m.audits['viewport-insight'];
    if (vp && vp.score !== null && vp.score < 0.9) add('mobile_viewport_missing', 'mobile', 'critical');
  }
  if (m && d && m.scores.performance !== null && d.scores.performance !== null && d.scores.performance - m.scores.performance >= 25) {
    add('mobile_slower_than_desktop', 'mobile', 'medium', { mobile: m.scores.performance, desktop: d.scores.performance });
  }
  if (m) {
    const tap = m.audits['target-size'] ?? m.audits['tap-targets'];
    if (tap && tap.score !== null && tap.score < 0.9) add('mobile_tap_targets', 'mobile', 'medium', { items: tap.items ?? null });
    const font = m.audits['font-size'];
    if (font && font.score !== null && font.score < 0.9) add('mobile_font_size', 'mobile', 'medium', { detail: font.displayValue ?? null });
  }

  /* ───────── SEO ───────── */
  if (p) {
    const tl = p.title?.length ?? 0;
    if (!p.title) add('seo_title_missing', 'seo', 'high');
    else if (tl < 10 || tl > 65) add('seo_title_length', 'seo', 'low', { length: tl, title: p.title.slice(0, 90) });

    const dl = p.metaDescription?.length ?? 0;
    if (!p.metaDescription) add('seo_description_missing', 'seo', 'medium');
    else if (dl < 50 || dl > 165) add('seo_description_length', 'seo', 'low', { length: dl });

    const robots = `${p.robotsMeta ?? ''} ${site.headers['x-robots-tag'] ?? ''}`.trim();
    if (isNoindex(robots)) add('seo_noindex', 'seo', 'critical', { directive: robots });

    if (!p.canonical) add('seo_canonical_missing', 'seo', 'low');
    if (p.h1Count === 0) add('seo_h1_missing', 'seo', 'medium');
    else if (p.h1Count > 1) add('seo_h1_multiple', 'seo', 'low', { count: p.h1Count });
    if (!p.headingOrderOk) add('seo_heading_order', 'seo', 'low');
    if (!p.lang) add('seo_lang_missing', 'seo', 'low');
    if (p.imageCount > 0 && p.imagesMissingAlt > 0) {
      add('seo_image_alt', 'seo', p.imagesMissingAlt / p.imageCount > 0.5 ? 'medium' : 'low', { missing: p.imagesMissingAlt, total: p.imageCount });
    }
  }
  const seoRun = m?.scores.seo != null ? m : d;
  if (seoRun && seoRun.scores.seo !== null) {
    if (seoRun.scores.seo >= 90) good('strength_seo', 'seo', { score: seoRun.scores.seo });
    const robotsTxt = seoRun.audits['robots-txt'];
    if (robotsTxt && robotsTxt.score !== null && robotsTxt.score < 0.9) add('seo_robots_txt', 'seo', 'medium', { items: robotsTxt.items ?? null });
    const linkText = seoRun.audits['link-text'];
    if (linkText && linkText.score !== null && linkText.score < 0.9) add('seo_link_text', 'seo', 'low', { items: linkText.items ?? null });
    const anchors = seoRun.audits['crawlable-anchors'];
    if (anchors && anchors.score !== null && anchors.score < 0.9) add('seo_crawlable_links', 'seo', 'medium', { items: anchors.items ?? null });
    // When our own HTML reading was not possible, fall back to Lighthouse for the basics.
    if (!p) {
      const t = seoRun.audits['document-title'];
      if (t && t.score !== null && t.score < 0.9) add('seo_title_missing', 'seo', 'high');
      const desc = seoRun.audits['meta-description'];
      if (desc && desc.score !== null && desc.score < 0.9) add('seo_description_missing', 'seo', 'medium');
      const crawl = seoRun.audits['is-crawlable'];
      if (crawl && crawl.score !== null && crawl.score < 0.9) add('seo_noindex', 'seo', 'critical', { directive: 'Lighthouse: is-crawlable' });
    }
  }

  /* ───────── Security ───────── */
  if (site.error === 'tls_error') {
    add('sec_tls_invalid', 'security', 'critical', { detail: site.errorDetail ?? null });
  } else if (site.status !== null) {
    const h = site.headers;
    const csp = h['content-security-policy'];
    if (!site.https) add('sec_no_https', 'security', 'critical', { url: site.finalUrl });
    else {
      good('strength_https', 'security');
      if (site.httpRedirectsToHttps === false) add('sec_no_redirect', 'security', 'high');
      if (!h['strict-transport-security']) add('sec_hsts_missing', 'security', 'medium');
      const lhHttps = lab?.audits['is-on-https'];
      const lhCount = lhHttps && lhHttps.score !== null && lhHttps.score < 1 ? (lhHttps.items ?? 1) : 0;
      const htmlCount = site.onPage?.mixedContentCount ?? 0;
      if (htmlCount + lhCount > 0) {
        add('sec_mixed_content', 'security', 'high', {
          count: Math.max(htmlCount, lhCount),
          sample: site.onPage?.mixedContentSamples[0] ?? null,
        });
      }
    }
    if (!csp) add('sec_csp_missing', 'security', 'medium', { reportOnly: !!h['content-security-policy-report-only'] });
    if (!/nosniff/i.test(h['x-content-type-options'] ?? '')) add('sec_xcto_missing', 'security', 'low');
    if (!h['x-frame-options'] && !/frame-ancestors/i.test(csp ?? '')) add('sec_frame_missing', 'security', 'low');
    if (!h['referrer-policy']) add('sec_referrer_missing', 'security', 'low');
    if (!h['permissions-policy']) add('sec_permissions_missing', 'security', 'info');
    if (h['x-powered-by']) add('sec_tech_disclosure', 'security', 'info', { value: h['x-powered-by'].slice(0, 60) });
  }

  /* ───────── Accessibility ───────── */
  const a11yRun = m?.scores.accessibility != null ? m : d;
  if (a11yRun && a11yRun.scores.accessibility !== null) {
    const score = a11yRun.scores.accessibility;
    if (score < 50) add('a11y_score_low', 'accessibility', 'high', { score });
    else if (score < 90) add('a11y_score_medium', 'accessibility', 'medium', { score });
    else good('strength_accessibility', 'accessibility', { score });
    for (const audit of a11yRun.a11yFailures.slice(0, 6)) {
      add('a11y_issue', 'accessibility', 'medium', { audit: audit.id, title: audit.title, items: audit.items ?? null });
    }
  }

  /* ───────── User experience (inferred from HTML) ───────── */
  if (p) {
    const c = p.contact;
    const channels = [c.tel, c.email, c.whatsapp, c.contactLink, c.form].filter(Boolean).length;
    if (channels === 0) add('ux_no_contact', 'ux', 'high', {}, 'inferred');
    else {
      good('strength_contact', 'ux', { channels });
      if (!c.whatsapp) add('ux_no_whatsapp', 'ux', 'info', {}, 'inferred');
    }
    if (!p.hasNavLandmark && p.navLinkCount + p.headerLinkCount < 3) add('ux_no_navigation', 'ux', 'medium', {}, 'inferred');
    if (p.ctaCount === 0) add('ux_no_cta', 'ux', 'medium', {}, 'inferred');
    if (p.wordCount < 150) add('ux_thin_content', 'ux', 'low', { words: p.wordCount }, 'inferred');
  }
  if (lab) {
    const consoleErrors = lab.audits['errors-in-console'];
    if (consoleErrors && consoleErrors.score !== null && consoleErrors.score < 0.9) {
      add('ux_console_errors', 'ux', 'low', { items: consoleErrors.items ?? null });
    }
  }

  findings.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  return { findings, strengths };
}
