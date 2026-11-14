/**
 * PDF request validation and printable template. The report fixture is
 * SYNTHETIC: produced by scanning the generated test store
 * (scripts/build-fixture-stores.py), with screenshots replaced by a 1px image.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { pdfRequestSchema } from '../src/features/reports/schema';
import { buildReportHtml } from '../src/features/reports/template';
import type { AuditReport } from '../src/types/audit';

const sample = JSON.parse(fs.readFileSync(new URL('./fixtures/report-business.json', import.meta.url), 'utf8'));
const assets = { fonts: {}, logo: '' };
const clone = () => JSON.parse(JSON.stringify(sample));

test('PDF request keeps the business analysis', () => {
  const parsed = pdfRequestSchema.parse({ report: sample, locale: 'ar' });
  assert.ok(parsed.report.business, 'business must not be stripped');
  assert.equal(parsed.report.business?.platform.id, 'salla');
  assert.equal(parsed.report.business?.classification?.category.value, 'ecommerce', 'classification must not be stripped');
});

test('PDF request accepts a known category override and rejects others', () => {
  assert.equal(pdfRequestSchema.safeParse({ report: sample, locale: 'ar', categoryOverride: 'law' }).success, true);
  assert.equal(pdfRequestSchema.safeParse({ report: sample, locale: 'ar', categoryOverride: 'casino' }).success, false);
});

test('printable report uses the override for the professionalism score', () => {
  const report = pdfRequestSchema.parse({ report: sample, locale: 'en' }).report as AuditReport;
  const html = buildReportHtml(report, 'en', assets, 'corporate');
  assert.ok(html.includes('Chosen by you'));
  assert.ok(html.includes('Business website criteria'));
});

test('PDF request rejects non-data or SVG screenshots', () => {
  for (const bad of ['https://evil.example/x.png', 'data:image/svg+xml;base64,PHN2Zz4=', 'javascript:alert(1)']) {
    const r = clone();
    r.business.design.screenshots.desktop = bad;
    assert.equal(pdfRequestSchema.safeParse({ report: r, locale: 'en' }).success, false, bad);
  }
});

test('PDF request rejects unexpected identifiers and colours', () => {
  const r = clone();
  r.business.platform.id = '<script>';
  assert.equal(pdfRequestSchema.safeParse({ report: r, locale: 'en' }).success, false);
  const c = clone();
  c.business.identity.colors = [{ hex: 'red;background:url(x)', source: 'css', weight: 1 }];
  assert.equal(pdfRequestSchema.safeParse({ report: c, locale: 'en' }).success, false);
});

test('reports without business data still validate (older reports)', () => {
  const r = clone();
  delete r.business;
  assert.equal(pdfRequestSchema.safeParse({ report: r, locale: 'en' }).success, true);
});

test('printable report has the 12 numbered sections, RTL for Arabic', () => {
  const report = pdfRequestSchema.parse({ report: sample, locale: 'ar' }).report as AuditReport;
  const ar = buildReportHtml(report, 'ar', assets);
  assert.match(ar, /<html lang="ar" dir="rtl">/);
  for (let i = 1; i <= 14; i++) assert.ok(ar.includes(`>${String(i).padStart(2, '0')}</span>`), `section ${i}`);
  assert.ok(ar.includes('عطور المثال'));
  const en = buildReportHtml(report, 'en', assets);
  assert.match(en, /<html lang="en" dir="ltr">/);
  assert.ok(en.includes('It is not a measure of business quality'));
});

test('printable report escapes scanned text and never loads remote images', () => {
  const r = clone();
  r.business.identity.brandName.value = '<img src=x onerror=alert(1)>';
  r.business.catalog.products[0].name = '</td><script>alert(1)</script>';
  const report = pdfRequestSchema.parse({ report: r, locale: 'en' }).report as AuditReport;
  const html = buildReportHtml(report, 'en', assets);
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!/<img[^>]+src="https?:/.test(html), 'only data: images are embedded');
});
