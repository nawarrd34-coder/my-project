import type { Browser, Page } from 'puppeteer-core';
import { guardPage } from '@/lib/browser';
import type { DesignAnalysis, PlatformId, SearchTest } from '@/types/business';
import { rankColors } from './identity';
import { normalizeText } from './html';
import type { Robots } from './robots';
import { classifyUrl } from './patterns';

/**
 * Rendered pass in headless Chromium: what a visitor actually sees.
 * Measures computed typography, colours, the main call to action, mobile
 * layout problems, and runs the internal search the way a shopper would.
 */
export interface RenderInput {
  browser: Browser;
  url: string;
  platform: PlatformId;
  robots: Robots;
  query: string | null;
  searchUrl: ((q: string) => string) | null;
  deadline: number;
}

export interface RenderOutput {
  design: DesignAnalysis;
  search: {
    visibleDesktop: boolean | null;
    visibleMobile: boolean | null;
    autocomplete: boolean | null;
    present: boolean;
    tests: SearchTest[];
  };
  palette: string[];
}

const DESKTOP = { width: 1366, height: 860 };
const MOBILE = { width: 390, height: 844 };

const timeLeft = (deadline: number) => Math.max(0, deadline - Date.now());

async function open(page: Page, url: string, deadline: number) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: Math.min(20_000, timeLeft(deadline)) });
  // Let client-rendered storefronts paint (Salla/Zid components, lazy images).
  await page.waitForNetworkIdle({ idleTime: 600, timeout: Math.min(5_000, timeLeft(deadline)) }).catch(() => undefined);
}

/** Runs in the page. Plain JS only. */
const MEASURE = (productPattern: string) => {
  const re = new RegExp(productPattern, 'i');
  // On emulated phones the layout viewport stretches to fit over-wide content,
  // so window.innerWidth/innerHeight would hide overflow; use the real viewport.
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const vis = (el: Element) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05;
  };
  const parse = (c: string): [number, number, number, number] | null => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  };
  const lum = ([r, g, b]: number[]) => {
    const f = (v: number) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const contrast = (a: number[], b: number[]) => {
    const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
    return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100;
  };
  /** Effective background behind an element; null when an image sits behind it. */
  const bgOf = (el: Element | null): number[] | null => {
    let n: Element | null = el;
    while (n) {
      const s = getComputedStyle(n);
      if (s.backgroundImage && s.backgroundImage !== 'none' && !/gradient/.test(s.backgroundImage)) return null;
      const c = parse(s.backgroundColor);
      if (c && c[3] > 0.6) return c;
      n = n.parentElement;
    }
    return [255, 255, 255, 1];
  };
  const hex = (c: number[]) => `#${c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

  const texts = Array.from(document.querySelectorAll('h1,h2,h3,h4,p,a,button,li,span,label')).filter((el) => vis(el) && (el.textContent || '').trim().length > 1).slice(0, 600);
  const fam = new Map<string, number>();
  texts.forEach((el) => {
    const f = getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim();
    if (f) fam.set(f, (fam.get(f) || 0) + 1);
  });
  const size = (sel: string) => {
    const el = Array.from(document.querySelectorAll(sel)).find(vis);
    return el ? Math.round(parseFloat(getComputedStyle(el).fontSize)) : null;
  };
  const bodySizes = Array.from(document.querySelectorAll('p, li')).filter((el) => vis(el) && (el.textContent || '').trim().length > 20).slice(0, 80).map((el) => parseFloat(getComputedStyle(el).fontSize)).sort((a, b) => a - b);
  const median = bodySizes.length ? Math.round(bodySizes[Math.floor(bodySizes.length / 2)]) : null;

  // Colours that carry the brand: filled buttons, links, header background.
  const palette: Record<string, number> = {};
  const add = (c: number[] | null, w: number) => {
    if (!c || c[3] < 0.6) return;
    const h = hex(c);
    palette[h] = (palette[h] || 0) + w;
  };
  Array.from(document.querySelectorAll('button, a, [class*="btn"], header, nav, [class*="badge"]')).filter(vis).slice(0, 300).forEach((el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    add(parse(s.backgroundColor), Math.min(r.width * r.height, 40000) / 1000);
    if (el.tagName === 'A') add(parse(s.color), 2);
  });

  // Primary call to action: the most prominent filled button-like element near the top.
  const ctaWords = /shop|buy|order|book|start|get|contact|discover|explore|تسوق|اشتر|اطلب|احجز|ابدأ|تواصل|اكتشف|تصفح|اطلب الآن|تسوق الآن/i;
  const candidates = Array.from(document.querySelectorAll('a, button')).filter((el) => {
    if (!vis(el) || el.closest('header nav, footer')) return false;
    const t = (el.textContent || '').trim();
    if (!t || t.length > 40) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 80 && r.height >= 30;
  });
  const scored = candidates
    .map((el) => {
      const s = getComputedStyle(el);
      const bg = parse(s.backgroundColor);
      const filled = !!bg && bg[3] > 0.6;
      const r = el.getBoundingClientRect();
      const score = (filled ? 3 : 0) + (ctaWords.test(el.textContent || '') ? 3 : 0) + (r.top + window.scrollY < vh ? 2 : 0) + Math.min(r.width * r.height, 30000) / 15000;
      return { el, score, filled };
    })
    .sort((a, b) => b.score - a.score);
  let cta: { text: string; contrast: number | null; aboveFold: boolean } | null = null;
  if (scored[0] && scored[0].score >= 4) {
    const el = scored[0].el;
    const s = getComputedStyle(el);
    const fg = parse(s.color);
    const bg = bgOf(el);
    const r = el.getBoundingClientRect();
    cta = { text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40), contrast: fg && bg ? contrast(fg, bg) : null, aboveFold: r.top + window.scrollY < vh };
  }

  // The first large heading on screen (often on top of the hero banner).
  let hero: { text: string; contrast: number | null } | null = null;
  const big = Array.from(document.querySelectorAll('h1, h2, [class*="hero"] *, [class*="slide"] *')).find((el) => {
    if (!vis(el) || !el.textContent || el.children.length > 3) return false;
    const r = el.getBoundingClientRect();
    return parseFloat(getComputedStyle(el).fontSize) >= 26 && r.top + window.scrollY < vh;
  });
  if (big) {
    const fg = parse(getComputedStyle(big).color);
    const bg = bgOf(big);
    hero = { text: (big.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60), contrast: fg && bg ? contrast(fg, bg) : null };
  }

  // Product card images: proportions as displayed.
  const ratios = Array.from(document.querySelectorAll('a[href]'))
    .filter((a) => re.test((a as HTMLAnchorElement).pathname))
    .map((a) => a.querySelector('img'))
    .filter((img): img is HTMLImageElement => !!img && vis(img))
    .slice(0, 16)
    .map((img) => {
      const r = img.getBoundingClientRect();
      return Math.round((r.width / r.height) * 100) / 100;
    })
    .filter((x) => Number.isFinite(x) && x > 0);

  const navItems = Array.from(document.querySelectorAll('header nav a, header [role="navigation"] a, nav a')).filter((el) => vis(el) && el.getBoundingClientRect().top < 200).length;

  const searchSel = 'input[type="search"], input[name="q"], input[name="s"], input[name="search"], input[name="query"], input[placeholder*="search" i], input[placeholder*="بحث"], [aria-label*="search" i], [aria-label*="بحث"], [class*="search" i] button, salla-search';
  const searchEls = Array.from(document.querySelectorAll(searchSel));
  const searchVisible = searchEls.some(vis);

  const overflow = document.documentElement.scrollWidth > vw + 2;
  const tap = Array.from(document.querySelectorAll('a, button, input, select')).filter((el) => {
    if (!vis(el)) return false;
    const r = el.getBoundingClientRect();
    return r.top < vh * 3 && (r.width < 24 || r.height < 24) && (el.textContent || '').trim().length > 0;
  }).length;
  const tiny = texts.filter((el) => parseFloat(getComputedStyle(el).fontSize) < 12 && (el.textContent || '').trim().length > 3).length;

  return {
    fonts: Array.from(fam.entries()).sort((a, b) => b[1] - a[1]),
    textCount: texts.length,
    h1: size('h1'),
    h2: size('h2'),
    body: median,
    palette,
    cta,
    hero,
    ratios,
    navItems,
    searchPresent: searchEls.length > 0,
    searchVisible,
    overflow,
    tap,
    tiny,
  };
};

type Measured = ReturnType<typeof MEASURE>;

const productPatternFor = (platform: PlatformId) =>
  ({
    shopify: '/products/[^/]+/?$',
    salla: '/p\\d{4,}/?$',
    zid: '/products/[^/]+/?$',
    woocommerce: '/product/[^/]+/?$',
  })[platform as string] ?? '/(product|products|item|p)/[^/]+/?$';

async function shot(page: Page): Promise<string | null> {
  try {
    const b64 = await page.screenshot({ type: 'jpeg', quality: 55, encoding: 'base64' });
    return `data:image/jpeg;base64,${b64}`;
  } catch {
    return null;
  }
}

/** Count product results on a search results page, and how many mention the query. */
const COUNT_RESULTS = (productPattern: string, q: string) => {
  const re = new RegExp(productPattern, 'i');
  const norm = (s: string) =>
    s.toLowerCase().normalize('NFKD').replace(/[ً-ٰٟـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[̀-ͯ]/g, '');
  const nq = norm(q);
  const seen = new Map<string, string>();
  document.querySelectorAll('a[href]').forEach((a) => {
    const el = a as HTMLAnchorElement;
    if (el.closest('header, footer, nav')) return;
    if (!re.test(el.pathname)) return;
    const label = `${el.textContent || ''} ${el.querySelector('img')?.getAttribute('alt') || ''} ${el.getAttribute('title') || ''}`;
    const prev = seen.get(el.pathname) || '';
    seen.set(el.pathname, `${prev} ${label}`);
  });
  const body = document.body?.innerText || '';
  const noRes = /no (products|results)( were)? found|no results|nothing (was )?found|did not match any|0 results|لا توجد نتائج|لم يتم العثور|لم نجد|لا يوجد منتجات|لا توجد منتجات|لا يوجد نتائج/i.test(body);
  return {
    count: seen.size,
    relevant: Array.from(seen.values()).filter((t) => norm(t).includes(nq)).length,
    noResultMessage: noRes,
  };
};

export async function renderPass(input: RenderInput): Promise<RenderOutput> {
  const { browser, url, platform, robots, query, searchUrl, deadline } = input;
  const pattern = productPatternFor(platform);
  const page = await browser.newPage();
  const origin = new URL(url).host;
  // Respect robots.txt for every same-site navigation the page makes (the homepage itself was requested by the user).
  const homePath = new URL(url).pathname;
  const guard = await guardPage(page, {
    allowNavigation: (u) => u.host !== origin || u.pathname === homePath || robots.isAllowed(u.pathname + u.search),
  });
  const notes: string[] = [];
  const tests: SearchTest[] = [];
  let autocomplete: boolean | null = null;

  // Some bundlers wrap functions in a __name() helper; define it in the page so
  // the measurement functions passed to evaluate() run unchanged.
  await page.evaluateOnNewDocument('globalThis.__name = globalThis.__name || ((f) => f);');

  try {
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36 BusinessHealthCheck/1.0');
    await page.setViewport({ ...DESKTOP, deviceScaleFactor: 1 });
    await open(page, url, deadline);
    const desktop = (await page.evaluate(MEASURE, pattern)) as Measured;
    const desktopShot = await shot(page);

    await page.setViewport({ ...MOBILE, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 BusinessHealthCheck/1.0');
    await open(page, url, deadline);
    const mobile = (await page.evaluate(MEASURE, pattern)) as Measured;
    // Headless Chrome returns a blank capture for an emulated phone whose page
    // is wider than the screen. The overflow has already been measured above;
    // clipping it here only lets the screenshot show the first screen a phone shows.
    if (mobile.overflow) {
      await page
        .evaluate(() => {
          document.documentElement.style.overflowX = 'clip';
          if (document.body) document.body.style.overflowX = 'clip';
        })
        .catch(() => undefined);
    }
    const mobileShot = await shot(page);

    // Internal search, the way a shopper uses it.
    const testQuery = async (q: string, kind: SearchTest['kind']) => {
      if (timeLeft(deadline) < 6_000) {
        tests.push({ query: q, kind, status: 'skipped', resultCount: null, relevantCount: null, noResultMessage: null, url: null, via: 'browser' });
        return;
      }
      await page.setViewport({ ...DESKTOP, deviceScaleFactor: 1 });
      let target: string | null = searchUrl ? searchUrl(q) : null;
      if (target) {
        const u = new URL(target);
        if (u.host === origin && !robots.isAllowed(u.pathname + u.search)) {
          tests.push({ query: q, kind, status: 'blocked_by_robots', resultCount: null, relevantCount: null, noResultMessage: null, url: target, via: 'browser' });
          return;
        }
        await open(page, target, deadline);
      } else {
        // No known results URL: type into the visible search box and submit.
        await open(page, url, deadline);
        const field = await page.$('input[type="search"], input[name="q"], input[name="s"], input[name="search"], input[name="query"], input[placeholder*="search" i], input[placeholder*="بحث"]');
        if (!field) {
          tests.push({ query: q, kind, status: 'skipped', resultCount: null, relevantCount: null, noResultMessage: null, url: null, via: 'browser' });
          return;
        }
        const visible = await field.isVisible().catch(() => false);
        if (!visible) {
          const toggle = await page.$('[aria-label*="search" i], [aria-label*="بحث"], [class*="search" i] button, button[class*="search" i]');
          await toggle?.click().catch(() => undefined);
          await new Promise((r) => setTimeout(r, 500));
        }
        await field.click({ delay: 20 }).catch(() => undefined);
        await field.type(q, { delay: 35 }).catch(() => undefined);
        if (kind === 'representative') {
          await new Promise((r) => setTimeout(r, 1_400));
          autocomplete = await page.evaluate((pat: string) => {
            const re = new RegExp(pat, 'i');
            const lists = Array.from(document.querySelectorAll('[role="listbox"], [class*="suggest" i], [class*="autocomplete" i], [class*="predictive" i], [class*="search-result" i], [class*="search__result" i]'));
            return lists.some((l) => {
              const r = l.getBoundingClientRect();
              return r.width > 0 && r.height > 20 && Array.from(l.querySelectorAll('a[href]')).some((a) => re.test((a as HTMLAnchorElement).pathname) || (a.textContent || '').trim().length > 2);
            });
          }, pattern);
        }
        // The guard aborts the submission if it would request a path robots.txt disallows.
        const before = guard.navigationsBlocked();
        await Promise.all([page.waitForNavigation({ timeout: 8_000, waitUntil: 'domcontentloaded' }).catch(() => undefined), field.press('Enter').catch(() => undefined)]);
        await page.waitForNetworkIdle({ idleTime: 600, timeout: 4_000 }).catch(() => undefined);
        if (guard.navigationsBlocked() > before) {
          tests.push({ query: q, kind, status: 'blocked_by_robots', resultCount: null, relevantCount: null, noResultMessage: null, url: null, via: 'browser' });
          return;
        }
        target = page.url();
        if (new URL(target).pathname === homePath && !new URL(target).search) {
          // Nothing navigated and no results appeared: the test could not run.
          tests.push({ query: q, kind, status: 'failed', resultCount: null, relevantCount: null, noResultMessage: null, url: null, via: 'browser' });
          return;
        }
      }
      const res = (await page.evaluate(COUNT_RESULTS, pattern, q)) as ReturnType<typeof COUNT_RESULTS>;
      tests.push({ query: q, kind, status: 'ok', resultCount: res.count, relevantCount: res.relevant, noResultMessage: res.noResultMessage, url: target, via: 'browser' });
    };

    if (query && (desktop.searchPresent || mobile.searchPresent || searchUrl)) {
      await testQuery(query, 'representative');
      await testQuery('zqxv nonexistent 7391', 'no_result');
    }

    const fonts = desktop.fonts.map(([family, n]) => ({ family, share: Math.round((n / Math.max(desktop.textCount, 1)) * 100) / 100 })).slice(0, 5);
    const palette = rankColors(new Map(Object.entries(desktop.palette)), 'rendered', 5).map((c) => c.hex);
    if (desktop.hero && desktop.hero.contrast === null) notes.push('hero_text_over_image');

    return {
      design: {
        rendered: true,
        screenshots: { desktop: desktopShot, mobile: mobileShot },
        fonts,
        sizes: { h1: desktop.h1, h2: desktop.h2, body: desktop.body, mobileBody: mobile.body },
        palette,
        primaryCta: desktop.cta
          ? { text: desktop.cta.text, contrast: desktop.cta.contrast, aboveFoldDesktop: desktop.cta.aboveFold, aboveFoldMobile: !!mobile.cta?.aboveFold }
          : null,
        mobile: { horizontalOverflow: mobile.overflow, smallTapTargets: mobile.tap, tinyText: mobile.tiny },
        heroText: desktop.hero,
        productCardRatios: desktop.ratios,
        topNavItems: desktop.navItems,
        notes,
      },
      search: {
        present: desktop.searchPresent || mobile.searchPresent,
        visibleDesktop: desktop.searchPresent ? desktop.searchVisible : false,
        visibleMobile: mobile.searchPresent ? mobile.searchVisible : false,
        autocomplete,
        tests,
      },
      palette,
    };
  } finally {
    await page.close().catch(() => undefined);
  }
}

export { normalizeText, classifyUrl };
