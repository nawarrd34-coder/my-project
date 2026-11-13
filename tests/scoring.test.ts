import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeHtml } from '../src/features/audit/onpage';
import { buildFindings } from '../src/features/recommendations/rules';
import { CATEGORY_WEIGHTS, gradeFor, scoreAudit } from '../src/features/scoring/engine';
import { parsePageSpeed } from '../src/lib/pagespeed/parse';
import type { PsiOutcome, SiteProbe, StrategyData } from '../src/types/audit';

// Hand-written unit-test inputs. These exercise the maths only and are never shown as audit results.
const strategy = (perf: number, over: Partial<StrategyData> = {}): PsiOutcome => ({
  ok: true,
  data: {
    strategy: 'mobile',
    lighthouseVersion: 'test',
    scores: { performance: perf, accessibility: 80, seo: 90, bestPractices: 90 },
    metrics: {
      fcp: { value: 1500, score: 0.9 },
      lcp: { value: 5200, score: 0.2 },
      si: { value: 3000, score: 0.9 },
      tbt: { value: 150, score: 0.9 },
      cls: { value: 0.02, score: 1 },
    },
    audits: {},
    a11yFailures: [],
    seoFailures: [],
    field: null,
    ...over,
  },
});
const failed: PsiOutcome = { ok: false, error: 'quota' };

const html = `<!doctype html><html lang="ar"><head><title>متجر الرياض للعطور الفاخرة</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="متجر متخصص في العطور الشرقية والغربية مع توصيل سريع داخل المملكة العربية السعودية.">
<link rel="canonical" href="https://shop.example.sa/"></head><body>
<header><nav><a href="/">الرئيسية</a><a href="/products">المنتجات</a><a href="/contact">تواصل معنا</a></nav></header>
<h1>عطور فاخرة</h1><h2>الأكثر مبيعاً</h2><h2>جديدنا</h2>
<p>${'كلمة '.repeat(200)}</p>
<a class="btn" href="/products">تسوق الآن</a><a href="https://wa.me/000">واتساب</a><a href="tel:+000">اتصل</a>
<img src="http://cdn.example.sa/a.jpg"><img src="/b.jpg" alt="b">
</body></html>`;

const site = (over: Partial<SiteProbe> = {}): SiteProbe => ({
  ok: true,
  requestedUrl: 'https://shop.example.sa/',
  finalUrl: 'https://shop.example.sa/',
  status: 200,
  redirectCount: 0,
  https: true,
  httpRedirectsToHttps: true,
  ttfbMs: 120,
  headers: { 'strict-transport-security': 'max-age=1' },
  onPage: analyzeHtml(html, 'https://shop.example.sa/'),
  ...over,
});

test('weights sum to 100 and grade bands match the product definition', () => {
  assert.equal(Object.values(CATEGORY_WEIGHTS).reduce((a, b) => a + b, 0), 100);
  assert.deepEqual([95, 90, 89, 75, 74, 60, 59, 40, 39, 0].map(gradeFor), [
    'excellent', 'excellent', 'good', 'good', 'needs_improvement', 'needs_improvement', 'weak', 'weak', 'critical', 'critical',
  ]);
});

test('HTML analysis reads tags, contact channels, CTAs and mixed content', () => {
  const p = analyzeHtml(html, 'https://shop.example.sa/');
  assert.equal(p.title, 'متجر الرياض للعطور الفاخرة');
  assert.equal(p.lang, 'ar');
  assert.equal(p.h1Count, 1);
  assert.equal(p.headingOrderOk, true);
  assert.equal(p.navLinkCount, 3);
  assert.deepEqual(p.contact, { tel: true, email: false, whatsapp: true, contactLink: true, form: false });
  assert.ok(p.ctaCount >= 1);
  assert.equal(p.mixedContentCount, 1);
  assert.equal(p.imagesMissingAlt, 1);
  assert.equal(p.likelyClientRendered, false);
});

test('every check share within a category sums to 100', () => {
  const { categories } = scoreAudit({ site: site(), mobile: strategy(60), desktop: strategy(90) });
  for (const c of categories) assert.equal(c.checks.reduce((s, k) => s + k.weight, 0), 100, c.id);
});

test('performance is 60% mobile + 40% desktop; overall is the weighted mean', () => {
  const { categories, overall } = scoreAudit({ site: site(), mobile: strategy(60), desktop: strategy(90) });
  const by = Object.fromEntries(categories.map((c) => [c.id, c]));
  assert.equal(by.performance.score, 72);
  assert.equal(by.accessibility.score, 80);
  assert.equal(overall.coveredWeight, 100);
  const expected = Math.round(categories.reduce((s, c) => s + c.weight * (c.score as number), 0) / 100);
  assert.equal(overall.score, expected);
});

test('one missing PageSpeed run: remaining data is normalised, nothing invented', () => {
  const { categories } = scoreAudit({ site: site(), mobile: failed, desktop: strategy(90) });
  const by = Object.fromEntries(categories.map((c) => [c.id, c]));
  assert.equal(by.performance.score, 90); // only desktop available → its own value
  assert.equal(by.performance.status, 'partial');
  assert.equal(by.mobile.status, 'unavailable'); // viewport alone is too little to score
  assert.equal(by.mobile.score, null);
});

test('no PageSpeed data at all: Lighthouse categories unavailable and no overall score', () => {
  const { categories, overall } = scoreAudit({ site: site(), mobile: failed, desktop: failed });
  const by = Object.fromEntries(categories.map((c) => [c.id, c]));
  assert.equal(by.performance.score, null);
  assert.equal(by.accessibility.score, null);
  assert.equal(by.mobile.score, null);
  assert.equal(by.seo.status, 'partial');
  assert.notEqual(by.security.score, null);
  assert.equal(overall.score, null);
  assert.equal(overall.grade, null);
});

test('unreachable page: on-page categories unavailable, Lighthouse ones still scored', () => {
  const down = site({ ok: false, error: 'timeout', status: null, onPage: null, headers: {} });
  const { categories, overall } = scoreAudit({ site: down, mobile: strategy(70), desktop: strategy(80) });
  const by = Object.fromEntries(categories.map((c) => [c.id, c]));
  assert.equal(by.ux.score, null);
  assert.equal(by.security.score, null);
  assert.notEqual(by.performance.score, null);
  assert.equal(overall.coveredWeight, 25 + 20 + 20 + 10);
  assert.notEqual(overall.score, null);
});

test('findings carry measured evidence and are ordered by severity', () => {
  const { findings, strengths } = buildFindings({ site: site(), mobile: strategy(40), desktop: strategy(90) });
  const ids = findings.map((f) => f.id);
  assert.ok(ids.includes('perf_score_low'));
  assert.ok(ids.includes('perf_lcp'));
  assert.ok(ids.includes('sec_mixed_content'));
  assert.ok(ids.includes('mobile_slower_than_desktop'));
  assert.ok(!ids.includes('seo_title_missing'));
  assert.equal(findings.find((f) => f.id === 'perf_lcp')?.params.value, 5200);
  const rank = { critical: 0, high: 1, medium: 2, low: 3, info: 4 } as const;
  for (let i = 1; i < findings.length; i++) assert.ok(rank[findings[i - 1].severity] <= rank[findings[i].severity]);
  assert.ok(strengths.some((s) => s.id === 'strength_https'));
  assert.ok(findings.filter((f) => f.category === 'ux').every((f) => f.basis === 'inferred' || f.id === 'ux_console_errors'));
});

test('no findings are produced without data', () => {
  const down = site({ ok: false, error: 'timeout', status: null, onPage: null, headers: {} });
  const { findings, strengths } = buildFindings({ site: down, mobile: failed, desktop: failed });
  assert.equal(findings.length, 0);
  assert.equal(strengths.length, 0);
});

test('PageSpeed parser rejects malformed and errored responses', () => {
  assert.equal(parsePageSpeed(null).ok, false);
  assert.equal(parsePageSpeed({}).ok, false);
  const errored = parsePageSpeed({ lighthouseResult: { runtimeError: { code: 'FAILED_DOCUMENT_REQUEST' } } });
  assert.deepEqual(errored, { ok: false, error: 'lighthouse_failed', detail: 'FAILED_DOCUMENT_REQUEST' });
});
