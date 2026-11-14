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

test('tourism company with trip booking → tourism / online booking', () => {
  const c = classify([
    { url: 'https://trips.example/', kind: 'home', html: '<html lang="ar"><head><title>شركة سياحة وسفر</title><script type="application/ld+json">{"@type":"TravelAgency","name":"رحلات"}</script></head><body><h1>رحلات سياحية إلى جورجيا وتركيا</h1><p>باقات سفر عائلية تشمل الطيران والفندق</p><a href="/book">احجز رحلتك</a><h2>أشهر الباقات</h2><h3>جورجيا 7 أيام</h3><h3>طرابزون 6 أيام</h3></body></html>' },
    { url: 'https://trips.example/book', kind: 'booking', html: '<body><form><input type="date"><input type="tel"><button>تحقق من التوفر</button></form></body>' },
  ]);
  assert.equal(c.category.value, 'tourism');
  assert.equal(c.model.primary, 'online_booking');
  assert.ok(c.services.length >= 2, 'packages listed as offerings');
});

test('real estate agency with viewing appointments → real estate / appointments', () => {
  const c = classify([
    { url: 'https://homes.example/', kind: 'home', html: '<html lang="ar"><head><title>عقارات للبيع والإيجار في جدة</title></head><body><h1>شقق وفلل للبيع والإيجار</h1><a href="/contact">احجز موعد معاينة</a><h3>شقة 3 غرف للبيع</h3><h3>فيلا للإيجار</h3></body></html>' },
  ]);
  assert.equal(c.category.value, 'real_estate');
  assert.equal(c.model.primary, 'appointments');
});

test('medical clinic with appointment booking → medical / appointments, specialties as services', () => {
  const c = classify([
    { url: 'https://clinic.example/', kind: 'home', html: '<html lang="ar"><head><title>عيادات طب الأسنان والجلدية</title><script type="application/ld+json">{"@type":"MedicalClinic","name":"عيادات","openingHours":"Sa-Th 09:00-22:00"}</script></head><body><h1>عيادات طب الأسنان والجلدية</h1><a href="/booking">احجز موعدك</a><section><h2>العيادات</h2><h3>طب الأسنان</h3><h3>الجلدية والتجميل</h3><h3>طب الأطفال</h3></section></body></html>' },
  ]);
  assert.equal(c.category.value, 'medical');
  assert.equal(c.model.primary, 'appointments');
  assert.deepEqual(c.services.map((s) => s.name), ['طب الأسنان', 'الجلدية والتجميل', 'طب الأطفال']);
});

test('custom-built store without a platform signature → online store from its own cart', () => {
  const c = classify([
    { url: 'https://dates.example/', kind: 'home', html: '<html lang="ar"><head><title>متجر تمور وقهوة</title></head><body><a href="/cart">السلة</a><h1>تمور فاخرة</h1><div class="product-card"><h3>تمر سكري</h3><span>45 ر.س</span><button>أضف إلى السلة</button></div><div><h3>عجوة</h3><span>90 ر.س</span><button>أضف إلى السلة</button></div></body></html>' },
  ]);
  assert.equal(c.category.value, 'ecommerce');
  assert.equal(c.model.primary, 'direct_sales');
});

test('construction company asking for quotations → construction / quotation', () => {
  const c = classify([
    { url: 'https://build.example/', kind: 'home', html: '<html lang="ar"><head><title>شركة مقاولات وإنشاءات</title><meta name="description" content="مقاولات عامة وإنشاءات وصيانة"></head><body><h1>مقاولات وإنشاءات هندسية</h1><a href="/contact">اطلب عرض سعر</a><h2>خدماتنا</h2><ul><li>البناء</li><li>الترميم</li><li>الصيانة</li></ul></body></html>' },
  ]);
  assert.equal(c.category.value, 'construction');
  assert.equal(c.model.primary, 'quotation');
  assert.equal(c.services.length, 3);
});

test('proof of experience and the main headline are read from the pages', () => {
  const c = classify([
    { url: 'https://firm.example/', kind: 'home', html: '<body><section><h1>محامون للشركات في الرياض</h1><p>نمثل الشركات الناشئة أمام المحاكم التجارية والعمالية منذ 2008 ونصيغ عقودها.</p></section><h2>فريق المحامين</h2><p>أكثر من 900 قضية</p><h2>عملاؤنا</h2></body>' },
  ]);
  assert.equal(c.signals.hero?.headline, 'محامون للشركات في الرياض');
  assert.equal(c.signals.hero?.support, true);
  assert.deepEqual([...new Set(c.signals.proof?.map((p) => p.kind))].sort(), ['clients', 'numbers', 'team']);
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

test('"Excellent" is not awarded without a visual assessment; the report says why', () => {
  const r = structuredClone(sample);
  // Make every measurable criterion pass to reach 90+.
  r.overall.score = 100;
  r.categories = r.categories.map((c) => ({ ...c, score: 100 }));
  const p = scoreProfessional(r, 'corporate')!;
  if (p.overall.score !== null && p.overall.score >= 90) {
    assert.equal(p.overall.level, 'professional');
    assert.equal(p.overall.levelCap, 'needs_visual_assessment');
  }
  assert.equal(p.visualAssessment, false);
  assert.equal(p.basisCounts.ai, 0, 'no AI judgement in Phase 1');
});

test('basis counts add up and confidence follows coverage', () => {
  const p = scoreProfessional(sample)!;
  const total = Object.values(p.basisCounts).reduce((n, v) => n + v, 0);
  assert.equal(total, p.criteria.length);
  assert.ok(p.overall.criteriaCoverage > 0 && p.overall.criteriaCoverage <= 1);
  const r = structuredClone(sample);
  r.business!.design = NO_RENDER;
  assert.notEqual(scoreProfessional(r)!.overall.confidence, 'high');
});

test('reports made before business analysis get no professionalism score', () => {
  const r = structuredClone(sample);
  delete r.business;
  assert.equal(scoreProfessional(r), null);
});

test('observation text is translated, not internal keys', () => {
  const reg = proAr.criteria.registration.observed({ found: 'commercialRegistration, vatNumber' }, 100);
  assert.ok(reg.includes('السجل التجاري') && reg.includes('الرقم الضريبي') && !/[a-z][A-Z]/.test(reg), reg);
  const proof = proEn.criteria.proof_elements.observed({ count: 2, kinds: 'cases, team' }, 80);
  assert.ok(proof.includes('case studies'), proof);
  const ch = proAr.criteria.contact_channels.observed({ count: 2, channels: 'whatsapp, contactPage' }, 75);
  assert.ok(ch.includes('واتساب') && ch.includes('صفحة تواصل'), ch);
});
