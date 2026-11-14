/**
 * Classification and professionalism score. The HTML below is SYNTHETIC
 * (hand-written pages carrying typical public signals); the report fixture
 * comes from scanning a generated test store. Nothing here is a real business.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { classifySite, type ClassifyPage } from '../src/features/business/classify';
import { load } from '../src/features/business/html';
import { detectIdentity } from '../src/features/business/identity';
import { detectPlatform } from '../src/features/business/platform';
import { PROFILE_WEIGHTS } from '../src/features/professional/config';
import { CRITERIA } from '../src/features/professional/criteria';
import { proAr } from '../src/features/professional/copy.ar';
import { proEn } from '../src/features/professional/copy.en';
import { scoreProfessional } from '../src/features/professional/score';
import type { AuditReport } from '../src/types/audit';
import type { DesignAnalysis } from '../src/types/business';

const NO_RENDER: DesignAnalysis = { rendered: false, screenshots: { desktop: null, mobile: null }, fonts: [], sizes: { h1: null, h2: null, body: null, mobileBody: null }, palette: [], primaryCta: null, mobile: null, heroText: null, productCardRatios: [], topNavItems: null, notes: [] };

function classify(pages: { url: string; kind: ClassifyPage['kind']; html: string }[]) {
  const read = pages.map((p) => ({ url: p.url, kind: p.kind, $: load(p.html) }));
  const platform = detectPlatform(pages.map((p) => p.html), {});
  const identity = detectIdentity({ $: read[0].$, html: pages[0].html, url: pages[0].url, platform, internalLinks: 8 });
  return classifySite({ pages: read, identity, platform, catalog: null, design: NO_RENDER, homepageProducts: 0 });
}

test('law firm with consultation booking → law / appointments', () => {
  const c = classify([
    { url: 'https://law.example/', kind: 'home', html: '<html lang="ar"><head><title>مكتب محاماة واستشارات قانونية</title></head><body><nav><a href="/book">احجز استشارة</a><a href="/contact">تواصل معنا</a></nav><h1>محامون ومستشارون قانونيون</h1><h2>مجالات الممارسة</h2><ul><li>القضايا التجارية</li><li>القضايا العمالية</li><li>صياغة العقود</li></ul><a href="https://wa.me/966500000000">واتساب</a></body></html>' },
    { url: 'https://law.example/book', kind: 'booking', html: '<body><h1>احجز موعد استشارة</h1><iframe src="https://calendly.com/x/consult"></iframe></body>' },
  ]);
  assert.equal(c.category.value, 'law');
  assert.equal(c.model.primary, 'appointments');
  assert.ok(c.model.signals[0].evidence.some((e) => /calendly/.test(e.value ?? '')), 'evidence names the booking widget');
  assert.deepEqual(c.services.map((s) => s.name), ['القضايا التجارية', 'القضايا العمالية', 'صياغة العقود']);
});

test('menu-only restaurant → restaurant / physical visit, not online sales', () => {
  const c = classify([
    { url: 'https://grill.example/', kind: 'home', html: '<html lang="ar"><head><title>مطعم مشويات في الرياض</title><script type="application/ld+json">{"@type":"Restaurant","name":"مطعم","openingHours":"Mo-Su 12:00-00:00"}</script></head><body><a href="/menu">المنيو</a><h1>مشويات ومندي</h1><p>ساعات العمل يومياً</p><iframe src="https://www.google.com/maps/embed?pb=x"></iframe></body></html>' },
  ]);
  assert.equal(c.category.value, 'restaurant');
  assert.equal(c.model.primary, 'physical_visit');
  assert.ok(!c.model.signals.some((s) => s.model === 'direct_sales'));
});

test('subscription software with a pricing page → saas / subscription', () => {
  const c = classify([
    { url: 'https://app.example/', kind: 'home', html: '<html lang="en"><head><title>Invoicing software for small businesses</title><meta name="description" content="Cloud software and SaaS invoicing"></head><body><h1>Invoicing software</h1><p>Software for businesses. Start your free trial.</p><a href="/signup">Start free trial</a></body></html>' },
    { url: 'https://app.example/pricing', kind: 'pricing', html: '<body><h1>Pricing</h1><p>49 SAR per month, billed monthly</p></body>' },
  ]);
  assert.equal(c.category.value, 'saas');
  assert.equal(c.model.primary, 'subscription');
  assert.equal(c.conversion?.label, 'Start free trial');
});

test('weak signals are marked uncertain instead of guessed', () => {
  const c = classify([{ url: 'https://x.example/', kind: 'home', html: '<html><head><title>Welcome</title></head><body><h1>Hello</h1></body></html>' }]);
  assert.equal(c.uncertain, true);
  assert.equal(c.category.confidence, 'low');
});

test('generic marketing phrases are detected on the homepage', () => {
  const c = classify([{ url: 'https://c.example/', kind: 'home', html: '<body><h1>نقدم أفضل الخدمات</h1><p>حلول متكاملة بجودة عالية</p></body>' }]);
  assert.ok(c.signals.genericPhrases.length >= 2);
});

// ─── Score engine ───────────────────────────────────────────────────────────

const sample = JSON.parse(fs.readFileSync(new URL('./fixtures/report-business.json', import.meta.url), 'utf8')) as AuditReport;

test('every profile’s pillar weights and every pillar’s criteria shares sum to 100', () => {
  for (const [profile, pillars] of Object.entries(PROFILE_WEIGHTS)) {
    assert.equal(Object.values(pillars).reduce((n, w) => n + w, 0), 100, profile);
    for (const pillar of Object.keys(pillars)) {
      const sum = CRITERIA.reduce((n, c) => n + (c.in[profile as 'ecommerce']?.pillar === pillar ? c.in[profile as 'ecommerce']!.weight : 0), 0);
      assert.equal(sum, 100, `${profile}.${pillar}`);
    }
  }
});

test('every criterion has copy in both languages', () => {
  for (const c of CRITERIA) {
    assert.ok((proEn.criteria as Record<string, unknown>)[c.id], `en ${c.id}`);
    assert.ok((proAr.criteria as Record<string, unknown>)[c.id], `ar ${c.id}`);
  }
});

test('checks that could not run are left out, not scored as zero', () => {
  const r = structuredClone(sample);
  r.business!.design = NO_RENDER;
  const p = scoreProfessional(r)!;
  const mobile = p.pillars.find((x) => x.id === 'mobile')!;
  assert.equal(mobile.score, null);
  assert.equal(mobile.status, 'unavailable');
  for (const c of p.criteria.filter((x) => x.pillar === 'mobile')) assert.equal(c.status, 'untested');
  assert.ok(p.overall.coveredWeight < 100);
});

test('a technically perfect site is not called professional for loading fast', () => {
  const r = structuredClone(sample);
  r.overall.score = 100;
  const p = scoreProfessional(r)!;
  const technical = p.pillars.find((x) => x.id === 'technical')!;
  assert.equal(technical.weight, 5);
  assert.equal(technical.score, 100);
  // The store's other weaknesses still dominate the total.
  assert.ok(p.overall.score !== null && p.overall.score < 90);
});

test('a user-confirmed category switches the evaluation profile', () => {
  const store = scoreProfessional(sample)!;
  const corporate = scoreProfessional(sample, 'corporate')!;
  assert.equal(store.profile, 'ecommerce');
  assert.equal(corporate.profile, 'general');
  assert.equal(corporate.categorySource, 'user');
  assert.ok(!corporate.criteria.some((c) => c.id === 'pp_images'));
});

test('low scores carry a severity; high scores do not', () => {
  const p = scoreProfessional(sample)!;
  for (const c of p.criteria) {
    if (c.score === null || c.score >= 70) assert.equal(c.severity, null, c.id);
    else assert.ok(c.severity, c.id);
  }
});

test('reports made before business analysis get no professionalism score', () => {
  const r = structuredClone(sample);
  delete r.business;
  assert.equal(scoreProfessional(r), null);
});
