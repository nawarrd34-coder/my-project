import { safeFetch, SafeFetchError } from '@/lib/security/safeFetch';
import { BrowserUnavailableError, launchBrowser } from '@/lib/browser';
import type { AuditTaskId } from '@/types/audit';
import type {
  BannerImage,
  BusinessAnalysis,
  CatalogAnalysis,
  CrawledPage,
  DesignAnalysis,
  PageKind,
  ProductSample,
  SearchAnalysis,
  SearchTest,
} from '@/types/business';
import { findBanners, toBannerImage } from './banners';
import { collectLinks, listedProducts, parseProductPage, parseShopifyProducts } from './catalog';
import { canonicalKey, load, normalizeText, sameSite, type Doc } from './html';
import { classifySite, type ClassifyPage } from './classify';
import { detectIdentity } from './identity';
import { readImageMeta } from './imageMeta';
import { analyzeJourney, NO_RESULTS, searchInterface } from './journey';
import { classifyUrl } from './patterns';
import { detectPlatform } from './platform';
import { businessRecommendations } from './recommendations';
import { renderPass } from './render';
import { allowAll, parseRobots, type Robots } from './robots';

export const LIMITS = {
  pages: 12,
  requests: 45,
  productPages: 5,
  categoryPages: 2,
  sitemapFiles: 4,
  shopifyFeedPages: 4,
  bannerProbes: 6,
  timeMs: 75_000,
};

type Emit = (id: AuditTaskId, s: 'start' | 'done' | 'fail', code?: string) => void;

interface Ctx {
  origin: string;
  robots: Robots;
  requests: number;
  deadline: number;
  budgetReached: boolean;
  robotsBlocked: number;
}

const timeLeft = (ctx: Ctx) => ctx.deadline - Date.now();

async function fetchText(ctx: Ctx, url: string, opts: { maxBytes?: number; respectRobots?: boolean; timeoutMs?: number } = {}) {
  if (ctx.requests >= LIMITS.requests || timeLeft(ctx) < 2_000) {
    ctx.budgetReached = true;
    return null;
  }
  const u = new URL(url);
  if (opts.respectRobots !== false && !ctx.robots.isAllowed(u.pathname + u.search)) {
    ctx.robotsBlocked += 1;
    return null;
  }
  ctx.requests += 1;
  try {
    return await safeFetch(url, { timeoutMs: Math.min(opts.timeoutMs ?? 10_000, timeLeft(ctx)), maxBytes: opts.maxBytes ?? 1_500_000, maxRedirects: 4 });
  } catch (err) {
    if (err instanceof SafeFetchError) return null;
    throw err;
  }
}

async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

// ─── Sitemap ────────────────────────────────────────────────────────────────

async function readSitemaps(ctx: Ctx, home: string, platform: Parameters<typeof classifyUrl>[1]) {
  const roots = ctx.robots.sitemaps.length ? ctx.robots.sitemaps.slice(0, 2) : [new URL('/sitemap.xml', home).toString()];
  let files = 0;
  let complete = true;
  const urls = new Set<string>();
  const queue = [...roots];
  const seen = new Set<string>();
  while (queue.length && files < LIMITS.sitemapFiles) {
    const next = queue.shift()!;
    if (seen.has(next) || !sameSite(next, home)) continue;
    seen.add(next);
    const res = await fetchText(ctx, next, { maxBytes: 3_000_000, respectRobots: false });
    files += 1;
    if (!res || res.status !== 200 || !/<(urlset|sitemapindex)/i.test(res.body)) continue;
    const locs = [...res.body.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)/gi)].map((m) => m[1].replace(/&amp;/g, '&'));
    if (/<sitemapindex/i.test(res.body)) {
      // Product sitemaps first, then the rest.
      const children = locs.sort((a, b) => Number(/product/i.test(b)) - Number(/product/i.test(a)));
      const productChildren = children.filter((c) => /product/i.test(c));
      if (productChildren.length > LIMITS.sitemapFiles - files) complete = false;
      queue.push(...(productChildren.length ? productChildren : children.slice(0, 2)));
    } else {
      locs.forEach((l) => urls.add(l));
      if (res.truncated) complete = false;
    }
  }
  if (queue.length) complete = false;
  let products = 0;
  let categories = 0;
  const productUrls: string[] = [];
  for (const u of urls) {
    const kind = classifyUrl(u, platform);
    if (kind === 'product') {
      products += 1;
      if (productUrls.length < 400) productUrls.push(u);
    } else if (kind === 'category') categories += 1;
  }
  return { found: files > 0 && urls.size > 0, files, urls: urls.size, products, categories, productUrls, complete };
}

// ─── Banners ────────────────────────────────────────────────────────────────

async function probeImage(ctx: Ctx, src: string) {
  if (ctx.requests >= LIMITS.requests || timeLeft(ctx) < 2_000) return { meta: null, bytes: null };
  ctx.requests += 1;
  try {
    const res = await safeFetch(src, { binary: true, maxBytes: 96_000, timeoutMs: Math.min(6_000, timeLeft(ctx)), maxRedirects: 3, headers: { range: 'bytes=0-98303', accept: 'image/avif,image/webp,image/*,*/*;q=0.5' } });
    const meta = res.bytes ? readImageMeta(res.bytes) : null;
    const range = /\/(\d+)\s*$/.exec(res.headers['content-range'] ?? '');
    const len = range ? Number(range[1]) : res.headers['content-length'] && !res.truncated && res.status === 200 ? Number(res.headers['content-length']) : null;
    return { meta, bytes: Number.isFinite(len ?? NaN) ? len : null };
  } catch {
    return { meta: null, bytes: null };
  }
}

async function logoDataUri(ctx: Ctx, src: string): Promise<string | null> {
  if (ctx.requests >= LIMITS.requests || timeLeft(ctx) < 2_000) return null;
  ctx.requests += 1;
  try {
    const res = await safeFetch(src, { binary: true, maxBytes: 160_000, timeoutMs: Math.min(6_000, timeLeft(ctx)), maxRedirects: 3, headers: { accept: 'image/png,image/svg+xml,image/webp,image/jpeg,image/*' } });
    const type = (res.headers['content-type'] ?? '').split(';')[0].trim();
    if (res.status !== 200 || res.truncated || !res.bytes || !/^image\/(png|jpe?g|webp|gif|svg\+xml|x-icon|vnd\.microsoft\.icon)$/i.test(type)) return null;
    // SVG can carry script; only embed raster images.
    if (/svg/i.test(type)) return null;
    return `data:${type};base64,${res.bytes.toString('base64')}`;
  } catch {
    return null;
  }
}

// ─── Search ─────────────────────────────────────────────────────────────────

const STOP = new Set(['the', 'and', 'for', 'with', 'new', 'set', 'من', 'في', 'على', 'مع', 'الى', 'إلى', 'عن', 'جديد', 'مجموعة']);

/** A word from a real product name the store's search should find. */
export function pickQuery(products: { name: string | null }[], categories: string[]): string | null {
  for (const name of [...products.map((p) => p.name), ...categories]) {
    if (!name) continue;
    const words = name
      .split(/[\s\-–—|/,()+]+/)
      .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
      .filter((w) => w.length >= 3 && !STOP.has(w.toLowerCase()) && !/^\d+$/.test(w))
      .sort((a, b) => b.length - a.length);
    if (words[0]) return words[0];
  }
  return null;
}

async function httpSearchTest(ctx: Ctx, url: string, q: string, kind: SearchTest['kind'], platform: Parameters<typeof classifyUrl>[1]): Promise<SearchTest> {
  const u = new URL(url);
  if (!ctx.robots.isAllowed(u.pathname + u.search)) {
    ctx.robotsBlocked += 1;
    return { query: q, kind, status: 'blocked_by_robots', resultCount: null, relevantCount: null, noResultMessage: null, url, via: 'http' };
  }
  const res = await fetchText(ctx, url, { respectRobots: false });
  if (!res || res.status >= 400) return { query: q, kind, status: 'failed', resultCount: null, relevantCount: null, noResultMessage: null, url, via: 'http' };
  const $ = load(res.body);
  $('header, footer, nav').remove();
  const links = collectLinks($, res.url, platform).products;
  const nq = normalizeText(q);
  const relevant = [...links.values()].filter((t) => normalizeText(t).includes(nq)).length;
  const noMsg = NO_RESULTS.test($('body').text());
  // Zero links and no "no results" message usually means results render client-side: inconclusive.
  const status: SearchTest['status'] = links.size === 0 && !noMsg ? 'failed' : 'ok';
  return { query: q, kind, status, resultCount: status === 'ok' ? links.size : null, relevantCount: status === 'ok' ? relevant : null, noResultMessage: noMsg, url: res.url, via: 'http' };
}

// ─── Entry point ────────────────────────────────────────────────────────────

export async function analyzeBusiness(args: {
  url: string;
  html: string | null;
  headers: Record<string, string>;
  emit: Emit;
}): Promise<BusinessAnalysis | null> {
  const started = Date.now();
  const { url, html, headers, emit } = args;
  if (!html) return null;
  const ctx: Ctx = { origin: new URL(url).origin, robots: allowAll, requests: 0, deadline: started + LIMITS.timeMs, budgetReached: false, robotsBlocked: 0 };
  const limits: string[] = [];
  const pages: CrawledPage[] = [{ url, kind: 'home', status: 200, ok: true }];
  const docs: Doc[] = [];
  /** Every page read, with its address and kind, for classification. */
  const readPages: ClassifyPage[] = [];

  // 1. Identity and platform from the homepage.
  emit('identity', 'start');
  const robotsRes = await fetchText(ctx, new URL('/robots.txt', url).toString(), { maxBytes: 256_000, respectRobots: false, timeoutMs: 6_000 });
  const robotsState: 'found' | 'missing' | 'error' = robotsRes ? (robotsRes.status === 200 && !/<html/i.test(robotsRes.body) ? 'found' : 'missing') : 'error';
  if (robotsState === 'found') ctx.robots = parseRobots(robotsRes!.body);

  const $home = load(html);
  docs.push($home);
  let platform = detectPlatform([html], headers);
  const homeLinks = collectLinks($home, url, platform.id);
  const identity = detectIdentity({ $: $home, html, url, platform, internalLinks: homeLinks.internalCount });
  readPages.push({ url, kind: 'home', $: $home });
  const homepageProducts = new Set([...homeLinks.products.keys(), ...listedProducts($home, url).map((p) => p.url)].map(canonicalKey)).size;
  emit('identity', 'done');

  // 2. Crawl: sitemap, platform feed, then a prioritised set of pages.
  emit('crawl', 'start');
  const sitemap = await readSitemaps(ctx, url, platform.id);
  const productUrls = new Map<string, string>();
  const addProduct = (u: string, name = '') => {
    const key = canonicalKey(u);
    if (!productUrls.has(key)) productUrls.set(key, u);
    void name;
  };
  homeLinks.products.forEach((name, u) => addProduct(u, name));
  listedProducts($home, url).forEach((p) => addProduct(p.url));
  sitemap.productUrls.forEach((u) => addProduct(u));
  const categories = new Map<string, string>();
  homeLinks.categories.forEach((name, u) => categories.set(canonicalKey(u), name || u));

  let feed: ProductSample[] | null = null;
  let feedComplete = false;
  if (platform.id === 'shopify') {
    const all: ProductSample[] = [];
    for (let p = 1; p <= LIMITS.shopifyFeedPages; p++) {
      const res = await fetchText(ctx, new URL(`/products.json?limit=250&page=${p}`, url).toString(), { maxBytes: 4_000_000 });
      if (!res || res.status !== 200) break;
      let parsed: ProductSample[] | null = null;
      try {
        parsed = parseShopifyProducts(JSON.parse(res.body), url);
      } catch {
        parsed = null;
      }
      if (!parsed) break;
      all.push(...parsed);
      if (parsed.length < 250) {
        feedComplete = true;
        break;
      }
    }
    if (all.length) {
      feed = all;
      all.forEach((p) => addProduct(p.url));
    }
  }

  const pick = (kind: PageKind, n: number) => homeLinks.other.filter((l) => classifyUrl(l.url, platform.id, l.text) === kind).slice(0, n).map((l) => l.url);
  const categoryTargets = [...homeLinks.categories.keys()].slice(0, LIMITS.categoryPages);
  // Info pages first (policies feed the journey checks), then pages that show
  // what the business offers and how it is bought or booked (classification).
  // The page budget still applies, so stores keep their product pages.
  const infoTargets = [...pick('about', 1), ...pick('contact', 1), ...pick('policy', 2), ...pick('services', 1), ...pick('pricing', 1), ...pick('booking', 1), ...pick('menu', 1)];
  const visited = new Set<string>([canonicalKey(url)]);
  const crawl = async (target: string, kind: PageKind): Promise<{ $: Doc; url: string } | null> => {
    const key = canonicalKey(target);
    if (visited.has(key) || pages.length >= LIMITS.pages) return null;
    visited.add(key);
    const res = await fetchText(ctx, target);
    if (!res) {
      pages.push({ url: target, kind, status: null, ok: false });
      return null;
    }
    const ok = res.status >= 200 && res.status < 300 && !!res.body;
    pages.push({ url: res.url, kind, status: res.status, ok });
    if (!ok) return null;
    const $ = load(res.body);
    docs.push($);
    readPages.push({ url: res.url, kind, $ });
    // Pages can confirm the platform (e.g. product templates).
    return { $, url: res.url };
  };

  const catPages = await pool(categoryTargets, 2, (t) => crawl(t, 'category'));
  for (const c of catPages) {
    if (!c) continue;
    const links = collectLinks(c.$, c.url, platform.id);
    links.products.forEach((name, u) => addProduct(u, name));
    links.categories.forEach((name, u) => categories.set(canonicalKey(u), name || u));
    listedProducts(c.$, c.url).forEach((p) => addProduct(p.url));
  }
  const productTargets = [...productUrls.values()].slice(0, LIMITS.productPages);
  const productPages = await pool(productTargets, 3, (t) => crawl(t, 'product'));
  await pool(infoTargets, 2, (t) => crawl(t, classifyUrl(t, platform.id)));
  emit('crawl', 'done');

  // Re-check the platform with every page we read.
  platform = detectPlatform([html, ...docs.slice(1).map(($) => $.html().slice(0, 600_000))], headers);

  // 3. Products and categories.
  emit('products', 'start');
  const samples = productPages.filter((p): p is { $: Doc; url: string } => !!p).map((p) => parseProductPage(p.$, p.url));
  const isStore = identity.websiteType.value === 'ecommerce' || productUrls.size > 0 || samples.length > 0;
  const catalog: CatalogAnalysis | null = isStore
    ? {
        productUrlsDiscovered: productUrls.size,
        productPagesAnalyzed: samples.length,
        catalogTotal:
          feed && feedComplete
            ? { value: feed.length, verified: true, source: 'shopify-products-json' }
            : sitemap.found && sitemap.complete && sitemap.products > 0
              ? { value: sitemap.products, verified: false, source: 'sitemap' }
              : null,
        products: (samples.length ? samples : (feed ?? []).slice(0, 6)).slice(0, 8),
        categories: {
          count: categories.size,
          names: [...categories.values()].filter((n) => n && !/^https?:/.test(n)).slice(0, 12),
        },
      }
    : null;

  const { candidates, sliders } = findBanners($home, url);
  const probes = await pool(candidates.slice(0, LIMITS.bannerProbes), 3, (c) => probeImage(ctx, c.src));
  const banners: BannerImage[] = candidates.map((c, i) => toBannerImage(c, probes[i]?.meta ?? null, probes[i]?.bytes ?? null));
  if (identity.logo) {
    const dataUri = await logoDataUri(ctx, identity.logo.url);
    if (dataUri) identity.logo.dataUri = dataUri;
  }
  emit('products', 'done');

  // 4. Search: the field in the HTML, then real queries.
  emit('search', 'start');
  const iface = searchInterface($home, url);
  const query = pickQuery(catalog?.products ?? feed ?? [], catalog?.categories.names ?? []);
  let searchUrl: ((q: string) => string) | null = null;
  if (iface.action && iface.inputName && iface.method === 'get') {
    searchUrl = (q) => {
      const u = new URL(iface.action!);
      Object.entries(iface.hidden).forEach(([k, v]) => u.searchParams.set(k, v));
      u.searchParams.set(iface.inputName!, q);
      return u.toString();
    };
  } else if (platform.id === 'shopify') {
    searchUrl = (q) => `${new URL('/search', url)}?q=${encodeURIComponent(q)}&type=product`;
  } else if (platform.id === 'woocommerce') {
    searchUrl = (q) => `${new URL('/', url)}?s=${encodeURIComponent(q)}&post_type=product`;
  }
  const tests: SearchTest[] = [];
  if (searchUrl && query) {
    tests.push(await httpSearchTest(ctx, searchUrl(query), query, 'representative', platform.id));
    tests.push(await httpSearchTest(ctx, searchUrl('zqxv nonexistent 7391'), 'zqxv nonexistent 7391', 'no_result', platform.id));
  }
  if (!query && iface.present) limits.push('search_no_query');
  emit('search', 'done');

  // 5. Rendered pass: design, mobile layout, and search as a shopper uses it.
  emit('design', 'start');
  let design: DesignAnalysis = {
    rendered: false,
    screenshots: { desktop: null, mobile: null },
    fonts: [],
    sizes: { h1: null, h2: null, body: null, mobileBody: null },
    palette: [],
    primaryCta: null,
    mobile: null,
    heroText: null,
    productCardRatios: [],
    topNavItems: null,
    notes: [],
  };
  const search: SearchAnalysis = {
    present: iface.present,
    source: iface.source,
    action: iface.action,
    inputName: iface.inputName,
    placeholder: iface.placeholder,
    visibleDesktop: null,
    visibleMobile: null,
    autocomplete: null,
    tests,
  };
  if (process.env.AUDIT_RENDER === 'off') limits.push('render_disabled');
  else if (timeLeft(ctx) < 15_000) limits.push('render_no_time');
  else {
    let browser = null;
    try {
      browser = await launchBrowser();
      const needBrowserSearch = !!query && !tests.some((t) => t.kind === 'representative' && t.status === 'ok');
      const r = await renderPass({
        browser,
        url,
        platform: platform.id,
        robots: ctx.robots,
        query: needBrowserSearch ? query : null,
        searchUrl,
        deadline: Math.min(ctx.deadline + 20_000, started + LIMITS.timeMs + 20_000),
      });
      design = r.design;
      search.present = search.present || r.search.present;
      if (!search.source && r.search.present) search.source = 'rendered';
      search.visibleDesktop = r.search.visibleDesktop;
      search.visibleMobile = r.search.visibleMobile;
      search.autocomplete = r.search.autocomplete;
      if (needBrowserSearch && r.search.tests.length) {
        search.tests = [...tests.filter((t) => t.status === 'blocked_by_robots'), ...r.search.tests.filter((t) => !tests.some((h) => h.status === 'blocked_by_robots' && h.kind === t.kind))];
      }
      if (r.palette.length) {
        const theme = identity.colors.filter((c) => c.source === 'theme-color' && !r.palette.includes(c.hex));
        identity.colors = [...theme, ...r.palette.map((hex, i) => ({ hex, source: 'rendered' as const, weight: Math.round((1 - i * 0.15) * 100) / 100 }))].slice(0, 6);
      }
    } catch (err) {
      limits.push(err instanceof BrowserUnavailableError ? 'render_unavailable' : 'render_failed');
      if (!(err instanceof BrowserUnavailableError)) console.warn('[business] render pass failed', (err as Error).message);
    } finally {
      await browser?.close().catch(() => undefined);
    }
  }
  emit('design', design.rendered ? 'done' : 'fail', design.rendered ? undefined : limits[limits.length - 1]);

  const journey = analyzeJourney(docs);
  if (ctx.robotsBlocked) limits.push('robots_blocked_some');
  if (ctx.budgetReached) limits.push('budget_reached');

  const analysis: BusinessAnalysis = {
    version: 1,
    identity,
    platform,
    coverage: {
      pagesAnalyzed: pages.filter((p) => p.ok).length,
      requests: ctx.requests,
      robots: robotsState,
      robotsBlocked: ctx.robotsBlocked,
      sitemap: { found: sitemap.found, files: sitemap.files, urls: sitemap.urls, productUrls: sitemap.products, categoryUrls: sitemap.categories },
      pages: pages.slice(0, LIMITS.pages + 2),
      budgetReached: ctx.budgetReached,
      durationMs: Date.now() - started,
    },
    catalog,
    banners: { count: banners.length, sliders, banners },
    search,
    journey,
    design,
    recommendations: [],
    limits,
  };
  analysis.classification = classifySite({ pages: readPages, identity, platform, catalog, design, homepageProducts });
  analysis.recommendations = businessRecommendations(analysis);
  return analysis;
}
