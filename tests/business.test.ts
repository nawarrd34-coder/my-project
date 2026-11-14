/**
 * Detector tests. The HTML below is SYNTHETIC: small hand-written pages that
 * carry the public technical signatures of each platform. They test the
 * detection logic only and are never shown as audit results.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findBanners, toBannerImage } from '../src/features/business/banners';
import { collectLinks, parseProductPage, parseShopifyProducts } from '../src/features/business/catalog';
import { pickQuery } from '../src/features/business/analyze';
import { load } from '../src/features/business/html';
import { detectIdentity } from '../src/features/business/identity';
import { readImageMeta } from '../src/features/business/imageMeta';
import { analyzeJourney, searchInterface } from '../src/features/business/journey';
import { classifyUrl } from '../src/features/business/patterns';
import { detectPlatform } from '../src/features/business/platform';
import { businessRecommendations } from '../src/features/business/recommendations';
import { parseRobots } from '../src/features/business/robots';
import type { BusinessAnalysis } from '../src/types/business';

const shopifyHtml = `<html><head><link rel="stylesheet" href="//cdn.shopify.com/s/files/1/theme.css">
<script>window.Shopify = {}; Shopify.theme = {"name":"Dawn"}; Shopify.shop = "demo.myshopify.com";</script>
<meta name="shopify-checkout-api-token" content="x"></head><body><img src="/cdn/shop/files/hero.jpg"></body></html>`;
const sallaHtml = `<html><head><script src="https://cdn.salla.network/js/twilight.js"></script></head>
<body><salla-search></salla-search><salla-products-slider></salla-products-slider><script>salla.config.set({});</script></body></html>`;
const zidHtml = `<html><head><link href="https://media.zid.store/themes/abc/style.css" rel="stylesheet"></head><body><img src="https://media.zid.store/x/product.jpg"></body></html>`;
const wooHtml = `<html><head><meta name="generator" content="WordPress 6.6"><meta name="generator" content="WooCommerce 9.1"><link href="/wp-content/plugins/woocommerce/assets/css/woocommerce.css"></head><body class="home woocommerce-js"></body></html>`;
const nextHtml = `<html><head><script src="/_next/static/chunks/main.js"></script></head><body><script id="__NEXT_DATA__">{}</script></body></html>`;

test('platform: recognises Shopify, Salla, Zid and WooCommerce from public signatures', () => {
  const s = detectPlatform([shopifyHtml], { 'x-shopid': '123' });
  assert.equal(s.id, 'shopify');
  assert.equal(s.confidence, 'high');
  assert.ok(s.evidence.some((e) => /cdn\.shopify\.com/.test(e)));
  assert.equal(detectPlatform([sallaHtml], {}).id, 'salla');
  assert.equal(detectPlatform([sallaHtml], {}).confidence, 'high');
  assert.equal(detectPlatform([zidHtml], {}).id, 'zid');
  const woo = detectPlatform([wooHtml], {});
  assert.equal(woo.id, 'woocommerce');
  assert.ok(woo.evidence.some((e) => /WordPress/.test(e)));
});

test('platform: an unrecognised stack is "unknown", never assumed custom; frameworks are reported separately', () => {
  const r = detectPlatform([nextHtml], { 'x-powered-by': 'Next.js' });
  assert.equal(r.id, 'unknown');
  assert.equal(r.confidence, null);
  assert.ok(r.frameworks.includes('Next.js'));
  // A single link to salla.sa (e.g. "built by") is only a weak hint.
  const weak = detectPlatform(['<a href="https://salla.sa">Salla</a>'], {});
  assert.equal(weak.id, 'unknown');
});

test('robots.txt: longest match wins, wildcards and sitemaps are read', () => {
  const r = parseRobots(`User-agent: *\nDisallow: /search\nDisallow: /cart\nAllow: /search/help\nDisallow: /*?sort=\nSitemap: https://shop.example.sa/sitemap.xml`);
  assert.equal(r.isAllowed('/search?q=oud'), false);
  assert.equal(r.isAllowed('/search/help'), true);
  assert.equal(r.isAllowed('/collections/all?sort=price'), false);
  assert.equal(r.isAllowed('/products/oud'), true);
  assert.deepEqual(r.sitemaps, ['https://shop.example.sa/sitemap.xml']);
  assert.equal(parseRobots('User-agent: *\nDisallow:').isAllowed('/anything'), true);
});

test('image headers: PNG, JPEG and WebP dimensions are read from bytes', () => {
  const png = Buffer.alloc(32);
  png.writeUInt32BE(0x89504e47, 0);
  png.write('IHDR', 12, 'ascii');
  png.writeUInt32BE(1920, 16);
  png.writeUInt32BE(720, 20);
  assert.deepEqual(readImageMeta(png), { format: 'png', width: 1920, height: 720 });

  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0xd0, 0x07, 0x80, 0x03, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(readImageMeta(jpg), { format: 'jpeg', width: 1920, height: 720 });

  const webp = Buffer.alloc(32);
  webp.write('RIFF', 0, 'ascii');
  webp.write('WEBP', 8, 'ascii');
  webp.write('VP8X', 12, 'ascii');
  webp.writeUIntLE(1599, 24, 3);
  webp.writeUIntLE(899, 27, 3);
  assert.deepEqual(readImageMeta(webp), { format: 'webp', width: 1600, height: 900 });
  assert.equal(readImageMeta(Buffer.from('not an image at all')), null);
});

const storeHome = `<!doctype html><html lang="ar" dir="rtl"><head>
<title>عطور الواحة | متجر العطور والعود</title>
<meta name="description" content="متجر سعودي متخصص في العطور الشرقية ودهن العود والبخور مع توصيل لجميع مدن المملكة">
<meta property="og:site_name" content="عطور الواحة">
<meta name="theme-color" content="#7a3e9d">
<style>:root{--color-primary:#7a3e9d;--accent:#c79a3b} .btn{background:#7a3e9d} .sale{color:#c79a3b}</style>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"عطور الواحة","logo":"https://shop.example.sa/logo.png"}</script>
</head><body>
<header><a href="/"><img src="/logo.png" alt="عطور الواحة" class="logo"></a>
<nav><a href="/oud/c123456">العود</a><a href="/perfumes/c654321">العطور</a><a href="/cart">السلة</a></nav>
<form action="/search" method="get"><input type="search" name="q" placeholder="ابحث عن منتج"></form></header>
<div class="hero-slider swiper"><a href="/oud/c123456"><picture><source media="(max-width: 600px)" srcset="/b1-m.jpg"><img src="/b1.jpg" alt="تخفيضات العود" width="1920" height="700"></picture></a>
<img src="/b2.jpg" width="1920" height="600"></div>
<h1>عطور فاخرة</h1>
<a href="/dehn-oud-cambodi/p1234567">دهن عود كمبودي فاخر</a><a href="/musk-tahara/p7654321">مسك الطهارة</a>
<footer><p>الدفع عبر مدى و Apple Pay و تابي</p><a href="https://wa.me/9665">واتساب</a><a href="tel:+966500000000">اتصل</a><a href="/policy/returns">سياسة الاسترجاع</a><p>السجل التجاري 1010101010</p><p>الشحن لجميع المدن</p></footer>
</body></html>`;

test('identity: brand, logo, type, industry, country, colours and contacts from a store homepage', () => {
  const $ = load(storeHome);
  const platform = detectPlatform([sallaHtml], {});
  const id = detectIdentity({ $, html: storeHome, url: 'https://shop.example.sa/', platform, internalLinks: 7 });
  assert.equal(id.brandName?.value, 'عطور الواحة');
  assert.equal(id.logo?.url, 'https://shop.example.sa/logo.png');
  assert.equal(id.websiteType.value, 'ecommerce');
  assert.equal(id.industry?.value, 'perfume');
  assert.equal(id.country?.code, 'SA');
  assert.equal(id.language.primary, 'ar');
  assert.equal(id.colors[0].hex, '#7a3e9d');
  assert.ok(id.colors.some((c) => c.hex === '#c79a3b'));
  assert.equal(id.contact.whatsapp, true);
  assert.equal(id.contact.phone, true);
});

test('links: Salla product and category URLs are classified', () => {
  const $ = load(storeHome);
  const links = collectLinks($, 'https://shop.example.sa/', 'salla');
  assert.equal(links.products.size, 2);
  assert.equal(links.categories.size, 2);
  assert.equal(classifyUrl('https://x.com/products/blue-shirt', 'shopify'), 'product');
  assert.equal(classifyUrl('https://x.com/collections/summer', 'shopify'), 'category');
  assert.equal(classifyUrl('https://x.com/product-category/oud/', 'woocommerce'), 'category');
  assert.equal(classifyUrl('https://x.com/pages/about-us', 'shopify'), 'about');
});

test('banners: slider images, a mobile variant and links are found', () => {
  const $ = load(storeHome);
  const { candidates, sliders } = findBanners($, 'https://shop.example.sa/');
  assert.equal(candidates.length, 2);
  assert.equal(sliders, 1);
  assert.equal(candidates[0].mobileVariant, true);
  assert.equal(candidates[0].linked, true);
  const img = toBannerImage(candidates[1], { width: 1920, height: 600, format: 'jpeg' }, 620_000);
  assert.equal(img.ratio, 3.2);
  assert.equal(img.measured, true);
});

test('search interface and customer journey signals', () => {
  const $ = load(storeHome);
  const s = searchInterface($, 'https://shop.example.sa/');
  assert.equal(s.present, true);
  assert.equal(s.inputName, 'q');
  assert.equal(s.action, 'https://shop.example.sa/search');
  const j = analyzeJourney([$]);
  assert.deepEqual(j.paymentMethods.sort(), ['Apple Pay', 'Tabby', 'mada'].sort());
  assert.equal(j.returnPolicy, true);
  assert.equal(j.deliveryInfo, true);
  assert.equal(j.trust.commercialRegistration, true);
  assert.equal(j.cartLink, true);
});

test('product page: structured data first, HTML fallback second', () => {
  const ld = load(`<html><body><script type="application/ld+json">{"@type":"Product","name":"دهن عود كمبودي","image":["/a.jpg","/b.jpg","/c.jpg"],"description":"${'وصف '.repeat(40)}","offers":{"@type":"Offer","price":"450","priceCurrency":"SAR","availability":"https://schema.org/InStock"}}</script>
  <button class="btn">أضف للسلة</button><h3>منتجات مشابهة</h3></body></html>`);
  const p = parseProductPage(ld, 'https://shop.example.sa/dehn/p1234567');
  assert.equal(p.source, 'json-ld');
  assert.equal(p.price, '450');
  assert.equal(p.currency, 'SAR');
  assert.equal(p.imageCount, 3);
  assert.equal(p.availability, 'InStock');
  assert.equal(p.addToCart, true);
  assert.equal(p.related, true);

  const html = load(`<html><head><meta property="og:title" content="Blue Shirt"></head><body><h1>Blue Shirt</h1><p>SAR 120</p><p>Nice.</p></body></html>`);
  const q = parseProductPage(html, 'https://x.com/products/blue-shirt');
  assert.equal(q.name, 'Blue Shirt');
  assert.equal(q.price, '120');
  assert.equal(q.addToCart, false);
});

test('Shopify public product feed is parsed', () => {
  const feed = parseShopifyProducts({ products: [{ title: 'Oud Royal', handle: 'oud-royal', body_html: '<p>Rich oud</p>', images: [{ src: 'https://cdn.shopify.com/a.jpg' }], variants: [{ price: '199.00', available: true }] }] }, 'https://x.com/');
  assert.equal(feed?.length, 1);
  assert.equal(feed?.[0].url, 'https://x.com/products/oud-royal');
  assert.equal(feed?.[0].availability, 'InStock');
  assert.equal(parseShopifyProducts({ nope: true }, 'https://x.com/'), null);
});

test('search query comes from a real product name', () => {
  assert.equal(pickQuery([{ name: 'دهن عود كمبودي فاخر' }], []), 'كمبودي');
  assert.equal(pickQuery([{ name: 'The Blue Linen Shirt' }], []), 'Linen');
  assert.equal(pickQuery([], []), null);
});

test('recommendations fire only on observed evidence', () => {
  const base: BusinessAnalysis = {
    version: 1,
    identity: {
      brandName: { value: 'X', source: 'og' },
      siteTitle: 'X',
      description: null,
      logo: { url: 'https://x.sa/l.png', source: 'x' },
      colors: [],
      websiteType: { value: 'ecommerce', confidence: 'high', evidence: [] },
      industry: null,
      language: { primary: 'ar', declared: 'ar', arabicShare: 0.9 },
      country: { code: 'SA', evidence: [] },
      contact: { phone: true, email: false, whatsapp: true, contactPage: true, form: false, social: [] },
    },
    platform: { id: 'salla', confidence: 'high', evidence: [], frameworks: [] },
    coverage: { pagesAnalyzed: 5, requests: 9, robots: 'found', robotsBlocked: 0, sitemap: { found: false, files: 0, urls: 0, productUrls: 0, categoryUrls: 0 }, pages: [], budgetReached: false, durationMs: 1 },
    catalog: {
      productUrlsDiscovered: 30,
      productPagesAnalyzed: 2,
      catalogTotal: null,
      products: [
        { url: 'https://x.sa/a/p1', name: 'A', image: null, imageCount: 1, price: null, currency: null, descriptionLength: 40, availability: null, addToCart: true, related: false, source: 'html' },
        { url: 'https://x.sa/b/p2', name: 'B', image: null, imageCount: 5, price: '10', currency: 'SAR', descriptionLength: 400, availability: 'InStock', addToCart: true, related: false, source: 'json-ld' },
      ],
      categories: { count: 4, names: [] },
    },
    banners: { count: 1, sliders: 1, banners: [{ src: 'https://x.sa/b.jpg', alt: null, width: 1920, height: 600, ratio: 3.2, bytes: 700_000, format: 'jpeg', responsive: false, mobileVariant: false, inSlider: true, linked: true, measured: true }] },
    search: { present: true, source: 'html', action: null, inputName: 'q', placeholder: null, visibleDesktop: true, visibleMobile: false, autocomplete: null, tests: [{ query: 'oud', kind: 'representative', status: 'ok', resultCount: 0, relevantCount: 0, noResultMessage: false, url: null, via: 'http' }] },
    journey: { cartLink: true, accountLink: true, paymentMethods: ['mada'], deliveryInfo: true, returnPolicy: false, privacyPolicy: true, trust: { maroof: false, commercialRegistration: true, vatNumber: false, businessCenter: false }, reviews: true, navLinks: 6 },
    design: { rendered: false, screenshots: { desktop: null, mobile: null }, fonts: [], sizes: { h1: null, h2: null, body: null, mobileBody: null }, palette: [], primaryCta: null, mobile: null, heroText: null, productCardRatios: [], topNavItems: null, notes: [] },
    recommendations: [],
    limits: [],
  };
  const ids = businessRecommendations(base).map((r) => r.id);
  for (const id of ['product_price_missing', 'product_few_images', 'product_short_description', 'product_no_related', 'search_misses_products', 'search_hidden_mobile', 'banner_heavy', 'banner_no_mobile_version', 'banner_missing_alt', 'journey_no_return_policy']) {
    assert.ok(ids.includes(id), `expected ${id}`);
  }
  // Nothing about design is claimed when the page was not rendered.
  assert.ok(!ids.some((id) => id.startsWith('design_')));
  // Things that were observed to be fine do not produce recommendations.
  for (const id of ['product_no_add_to_cart', 'journey_no_payment_info', 'journey_no_delivery_info', 'journey_no_trust_details', 'brand_no_logo']) {
    assert.ok(!ids.includes(id), `did not expect ${id}`);
  }
});
