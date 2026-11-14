import type { BrandColor, BusinessIdentity, Confidence, ContactChannels, Detected, IndustryId, PlatformDetection, WebsiteType } from '@/types/business';
import { STORE_PLATFORMS } from './platform';
import { absUrl, arabicShare, bodyText, clean, clip, jsonLd, ldTypes, normalizeText, str, type Doc } from './html';

const TITLE_SEPARATORS = /\s+[|\-–—:•·»]\s+/;

function brandName($: Doc, ld: Record<string, unknown>[], host: string): { value: string; source: string } | null {
  const og = clean($('meta[property="og:site_name" i]').attr('content'));
  if (og) return { value: clip(og, 80), source: 'og:site_name' };
  for (const o of ld) {
    const types = ldTypes(o);
    if (types.some((t) => ['organization', 'store', 'onlinestore', 'localbusiness', 'restaurant', 'website', 'corporation'].includes(t))) {
      const n = str(o.name);
      if (n && n.length <= 80) return { value: n, source: `JSON-LD ${types[0]}` };
    }
  }
  const app = clean($('meta[name="application-name" i]').attr('content')) ?? clean($('meta[name="apple-mobile-web-app-title" i]').attr('content'));
  if (app) return { value: clip(app, 80), source: 'application-name meta' };
  const title = clean($('head > title').first().text());
  if (title) {
    const parts = title.split(TITLE_SEPARATORS).map((p) => p.trim()).filter(Boolean);
    // The brand is usually the shortest end of a "Page | Brand" title.
    if (parts.length > 1) {
      const candidate = [parts[parts.length - 1], parts[0]].sort((a, b) => a.length - b.length)[0];
      if (candidate.length <= 40) return { value: candidate, source: 'page title' };
    }
  }
  const logoAlt = clean($('header img[alt], [class*="logo" i] img[alt], img[class*="logo" i][alt]').first().attr('alt'));
  if (logoAlt && logoAlt.length <= 60 && !/logo|شعار/i.test(logoAlt)) return { value: logoAlt, source: 'logo alt text' };
  return null;
  void host;
}

function findLogo($: Doc, ld: Record<string, unknown>[], base: string): { url: string; source: string } | null {
  for (const o of ld) {
    if (!o.logo) continue;
    const u = absUrl(str(o.logo), base);
    if (u) return { url: u, source: 'JSON-LD logo' };
  }
  const candidates = $('header img, nav img, [class*="logo" i] img, img[class*="logo" i], img[id*="logo" i], img[alt*="logo" i], img[src*="logo" i], a[class*="logo" i] img');
  for (const el of candidates.toArray().slice(0, 12)) {
    const img = $(el);
    const src = img.attr('src') ?? img.attr('data-src') ?? img.attr('data-lazy-src');
    const marked = /logo|شعار/i.test(`${img.attr('class') ?? ''} ${img.attr('id') ?? ''} ${img.attr('alt') ?? ''} ${src ?? ''} ${img.parent().attr('class') ?? ''}`);
    const u = absUrl(src, base);
    if (u && (marked || img.closest('header').length)) return { url: u, source: marked ? 'logo image in page' : 'header image' };
  }
  const svgLogo = $('[class*="logo" i] svg, a[aria-label*="logo" i] svg').first();
  void svgLogo;
  const touch = absUrl($('link[rel="apple-touch-icon" i], link[rel="apple-touch-icon-precomposed" i]').first().attr('href'), base);
  if (touch) return { url: touch, source: 'apple-touch-icon' };
  const icon = absUrl($('link[rel="icon" i][sizes], link[rel="icon" i], link[rel="shortcut icon" i]').first().attr('href'), base);
  if (icon) return { url: icon, source: 'site icon' };
  return null;
}

// ─── Colours ────────────────────────────────────────────────────────────────

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Saturation and lightness in 0..1 (HSL). */
function satLight([r, g, b]: [number, number, number]) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { s, l };
}

const isNeutral = (hex: string) => {
  const { s, l } = satLight(hexToRgb(hex));
  return s < 0.18 || l < 0.08 || l > 0.94;
};

const dist = (a: string, b: string) => {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
};

const normHex = (v: string): string | null => {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return `#${h.toLowerCase()}`;
};

const rgbFn = (v: string): string | null => {
  const m = /rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/i.exec(v);
  if (!m) return null;
  return `#${[m[1], m[2], m[3]].map((x) => Math.min(255, Number(x)).toString(16).padStart(2, '0')).join('')}`;
};

/** Merge near-identical colours and keep the most used, saturated ones. */
// Browser default link colours (unstyled links) are not brand colours.
const BROWSER_DEFAULTS = new Set(['#0000ee', '#551a8b', '#0000ff', '#ff0000']);

export function rankColors(counts: Map<string, number>, source: BrandColor['source'], limit = 5): BrandColor[] {
  const merged: { hex: string; n: number }[] = [];
  for (const [hex, n] of [...counts].sort((a, b) => b[1] - a[1])) {
    if (isNeutral(hex) || BROWSER_DEFAULTS.has(hex)) continue;
    const near = merged.find((m) => dist(m.hex, hex) < 38);
    if (near) near.n += n;
    else merged.push({ hex, n });
  }
  const top = merged.sort((a, b) => b.n - a.n).slice(0, limit);
  const max = top[0]?.n ?? 1;
  return top.map((c) => ({ hex: c.hex, source, weight: Math.round((c.n / max) * 100) / 100 }));
}

function cssColors($: Doc): BrandColor[] {
  const out: BrandColor[] = [];
  const theme = normHex($('meta[name="theme-color" i]').first().attr('content') ?? '');
  if (theme && !isNeutral(theme)) out.push({ hex: theme, source: 'theme-color', weight: 1 });

  const counts = new Map<string, number>();
  const bump = (hex: string | null, w = 1) => hex && counts.set(hex, (counts.get(hex) ?? 0) + w);
  const css = [$('style').text().slice(0, 400_000), $('[style]').map((_, el) => $(el).attr('style')).get().join(';').slice(0, 100_000)].join('\n');
  // Brand custom properties weigh more than one-off colours.
  for (const m of css.matchAll(/--[a-z0-9-]*(primary|brand|main|accent|theme)[a-z0-9-]*\s*:\s*([^;}{]+)/gi)) {
    bump(normHex(m[2]) ?? rgbFn(m[2]), 6);
  }
  for (const m of css.matchAll(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi)) bump(normHex(m[0]));
  for (const m of css.matchAll(/rgba?\([^)]+\)/gi)) bump(rgbFn(m[0]));
  const ranked = rankColors(counts, 'css', 5).filter((c) => !out.some((o) => dist(o.hex, c.hex) < 38));
  return [...out, ...ranked].slice(0, 6);
}

// ─── Contact ────────────────────────────────────────────────────────────────

const SOCIAL: [string, RegExp][] = [
  ['instagram', /instagram\.com\//i],
  ['x', /(twitter|x)\.com\//i],
  ['snapchat', /snapchat\.com\//i],
  ['tiktok', /tiktok\.com\//i],
  ['facebook', /facebook\.com\//i],
  ['linkedin', /linkedin\.com\//i],
  ['youtube', /youtube\.com\/|youtu\.be\//i],
];

export function contactChannels($: Doc): ContactChannels {
  const hrefs = $('a[href]').map((_, el) => ($(el).attr('href') ?? '').trim()).get();
  const texts = $('a[href]').map((_, el) => `${$(el).text()} ${$(el).attr('href') ?? ''}`).get();
  return {
    phone: hrefs.some((h) => /^tel:/i.test(h)),
    email: hrefs.some((h) => /^mailto:/i.test(h)),
    whatsapp: hrefs.some((h) => /(wa\.me\/|api\.whatsapp\.com|whatsapp:\/\/|web\.whatsapp\.com)/i.test(h)),
    contactPage: texts.some((t) => /(contact|اتصل|تواصل|راسلنا)/i.test(t)),
    form: $('form').filter((_, el) => $(el).find('input[type="email"], input[type="tel"], textarea').length > 0).length > 0,
    social: SOCIAL.filter(([, re]) => hrefs.some((h) => re.test(h))).map(([name]) => name),
  };
}

// ─── Website type ───────────────────────────────────────────────────────────

const TYPE_SIGNALS: Record<Exclude<WebsiteType, 'other'>, { label: string; re: RegExp; w: number }[]> = {
  ecommerce: [
    { label: 'cart link', re: /href="[^"]*\/(cart|basket|checkout)\b|السلة|سلة المشتريات|عربة التسوق/i, w: 3 },
    { label: 'add-to-cart controls', re: /add[\s-]?to[\s-]?cart|أضف (الى|إلى) السلة|اضف للسلة|إضافة للسلة|أضف للسلة|اشتر الآن|buy now/i, w: 3 },
    { label: 'product prices', re: /(\d[\d,.]*\s?(ر\.?\s?س|ريال|SAR|SR)\b)|(SAR|ر\.س)\s?\d/i, w: 2 },
  ],
  restaurant: [
    { label: 'menu wording', re: /\b(our menu|food menu|view menu)\b|قائمة الطعام|المنيو|منيو|قائمتنا/i, w: 3 },
    { label: 'delivery / reservation wording', re: /order online|reserve a table|حجز طاولة|اطلب الآن|توصيل الطلبات|هنقرستيشن|جاهز|مرسول/i, w: 2 },
  ],
  booking: [
    { label: 'booking wording', re: /book (an )?appointment|book now|schedule (a )?(call|visit)|احجز موعد|احجز الآن|حجز موعد|احجز استشارة/i, w: 3 },
    { label: 'booking widget', re: /calendly\.com|setmore\.com|simplybook|fresha\.com|booksy\.com|acuityscheduling/i, w: 3 },
  ],
  portfolio: [
    { label: 'portfolio wording', re: /\b(portfolio|my work|case stud(y|ies)|selected work)\b|أعمالنا|معرض الأعمال|مشاريعنا السابقة/i, w: 3 },
  ],
  service: [
    { label: 'services wording', re: /\b(our services|services we offer|request a quote|get a quote)\b|خدماتنا|اطلب عرض سعر|طلب عرض سعر|اطلب خدمة/i, w: 3 },
  ],
  corporate: [
    { label: 'company wording', re: /\b(about us|our company|careers|investors|our team|our vision|our mission)\b|من نحن|عن الشركة|رؤيتنا|رسالتنا|الوظائف|فريق العمل/i, w: 2 },
  ],
  landing: [],
};

function websiteType($: Doc, html: string, ld: Record<string, unknown>[], platform: PlatformDetection, internalLinks: number): Detected<WebsiteType> {
  const score: Record<string, { n: number; ev: string[] }> = {};
  const add = (k: WebsiteType, n: number, ev: string) => {
    score[k] ??= { n: 0, ev: [] };
    score[k].n += n;
    score[k].ev.push(ev);
  };
  if (STORE_PLATFORMS.includes(platform.id)) add('ecommerce', 6, `store platform: ${platform.id}`);
  const types = new Set(ld.flatMap(ldTypes));
  if (types.has('product') || types.has('offer') || types.has('itemlist')) add('ecommerce', 3, 'Product structured data');
  if (['restaurant', 'foodestablishment', 'cafeorcoffeeshop', 'bakery'].some((t) => types.has(t))) add('restaurant', 6, 'Restaurant structured data');
  if (types.has('menu') || types.has('menusection')) add('restaurant', 3, 'Menu structured data');
  const text = `${html.slice(0, 600_000)}`;
  for (const [kind, signals] of Object.entries(TYPE_SIGNALS) as [Exclude<WebsiteType, 'other'>, (typeof TYPE_SIGNALS)['ecommerce']][]) {
    for (const s of signals) if (s.re.test(text)) add(kind, s.w, s.label);
  }
  if (internalLinks > 0 && internalLinks < 6) add('landing', 3, `only ${internalLinks} internal links`);
  void $;

  const ranked = Object.entries(score).sort((a, b) => b[1].n - a[1].n);
  if (!ranked.length) return { value: 'other', confidence: 'low', evidence: [] };
  const [best, second] = ranked;
  const margin = best[1].n - (second?.[1].n ?? 0);
  const confidence: Confidence = best[1].n >= 6 && margin >= 3 ? 'high' : best[1].n >= 3 ? 'medium' : 'low';
  return { value: best[0] as WebsiteType, confidence, evidence: best[1].ev.slice(0, 4) };
}

// ─── Industry ───────────────────────────────────────────────────────────────

const INDUSTRY: Record<IndustryId, RegExp> = {
  fashion: /\b(fashion|clothing|apparel|dresses|abaya|abayas|shoes|sneakers|hoodies?|shirts?|t-shirts?|linen|denim|jackets?|trousers)\b|أزياء|ملابس|عباي|عبايات|فساتين|أحذية|احذية|شماغ|ثوب|ثياب/gi,
  beauty: /\b(beauty|skincare|skin care|cosmetics|makeup|haircare|serum)\b|مكياج|عناية بالبشرة|مستحضرات|تجميل|سيروم/gi,
  perfume: /\b(perfume|fragrance|oud|bakhoor|incense|musk)\b|عطور|عطر|عود|بخور|دهن العود|مسك/gi,
  jewelry: /\b(jewelry|jewellery|gold|diamond|rings|necklace|watches)\b|مجوهرات|ذهب|الماس|خواتم|ساعات/gi,
  electronics: /\b(electronics|smartphone|laptop|headphones|gaming|accessories for iphone|chargers)\b|إلكترونيات|الكترونيات|جوالات|سماعات|شواحن|لابتوب/gi,
  home: /\b(furniture|home decor|kitchen|bedding|sofa|curtains)\b|أثاث|اثاث|ديكور|مفروشات|مطبخ|ستائر/gi,
  food: /\b(dates|coffee beans|honey|sweets|chocolate|grocery|spices)\b|تمور|تمر|قهوة مختصة|عسل|حلويات|شوكولاتة|بهارات|محمصة/gi,
  restaurant: /\b(restaurant|burger|pizza|grill|shawarma|dine in)\b|مطعم|برجر|بيتزا|مشويات|شاورما|مندي|كبسة/gi,
  cafe: /\b(cafe|café|coffee shop|espresso|latte|roastery)\b|كافيه|مقهى|قهوة|لاتيه|محمصة/gi,
  health: /\b(pharmacy|supplements|vitamins|fitness|wellness)\b|صيدلية|مكملات|فيتامينات|لياقة/gi,
  kids: /\b(kids|baby|toys|children)\b|أطفال|اطفال|ألعاب|العاب|مواليد/gi,
  sports: /\b(sports|sportswear|gym|football|outdoor)\b|رياضة|رياضية|نادي|معدات رياضية/gi,
  books: /\b(books|bookstore|novels|stationery)\b|كتب|مكتبة|روايات|قرطاسية/gi,
  gifts: /\b(gifts|flowers|bouquet|gift box)\b|هدايا|ورد|زهور|تغليف/gi,
  automotive: /\b(car parts|auto parts|tyres|tires|car care|automotive)\b|قطع غيار|سيارات|إطارات|زيوت/gi,
  real_estate: /\b(real estate|properties|apartments|villas|for rent|for sale)\b|عقار|عقارات|شقق|فلل|للبيع|للإيجار/gi,
  education: /\b(courses|academy|training|learning|school|institute)\b|دورات|أكاديمية|تدريب|تعليم|مدرسة|معهد/gi,
  technology: /\b(software|saas|app development|cloud|it solutions|cybersecurity)\b|برمجيات|تطوير التطبيقات|حلول تقنية|تقنية المعلومات|أمن سيبراني/gi,
  marketing: /\b(marketing agency|branding|social media management|advertising|digital marketing)\b|تسويق|هوية بصرية|إدارة حسابات|إعلانات|تسويق رقمي/gi,
  consulting: /\b(consulting|consultancy|advisory)\b|استشارات|استشارية/gi,
  construction: /\b(construction|contracting|engineering|maintenance)\b|مقاولات|إنشاءات|هندسية|صيانة/gi,
  travel: /\b(travel|tourism|hotel|flights|umrah)\b|سياحة|سفر|فنادق|طيران|عمرة/gi,
  events: /\b(events|weddings|catering|event planning)\b|فعاليات|مناسبات|حفلات|زواجات|تنظيم/gi,
  medical: /\b(clinic|dental|dermatology|hospital|doctor)\b|عيادة|عيادات|أسنان|جلدية|مستشفى|طبيب/gi,
  legal: /\b(law firm|lawyer|legal services|attorney)\b|محاماة|محامي|قانونية|استشارات قانونية/gi,
  finance: /\b(finance|insurance|investment|accounting|bookkeeping)\b|تمويل|تأمين|استثمار|محاسبة/gi,
  logistics: /\b(shipping|logistics|freight|courier|delivery services)\b|شحن|خدمات لوجستية|نقل|توصيل/gi,
};

function industry($: Doc, ld: Record<string, unknown>[], type: WebsiteType): Detected<IndustryId> | null {
  // Weight the strongest descriptors of what the site is about.
  const title = $('head > title').text();
  const desc = $('meta[name="description" i]').attr('content') ?? '';
  const heads = $('h1, h2, h3').slice(0, 30).map((_, el) => $(el).text()).get().join(' ');
  const nav = $('nav a, header a').slice(0, 60).map((_, el) => $(el).text()).get().join(' ');
  const ldText = ld.map((o) => `${str(o.name) ?? ''} ${str(o.description) ?? ''} ${ldTypes(o).join(' ')}`).join(' ');
  const corpus = [title, title, desc, desc, heads, nav, ldText].join(' \n ');

  const scores = (Object.entries(INDUSTRY) as [IndustryId, RegExp][])
    .map(([id, re]) => {
      const hits = corpus.match(re) ?? [];
      return { id, n: hits.length, words: [...new Set(hits.map((h) => h.trim().toLowerCase()))].slice(0, 4) };
    })
    .filter((s) => s.n > 0)
    .sort((a, b) => b.n - a.n);
  if (type === 'restaurant') {
    const r = scores.find((s) => s.id === 'restaurant' || s.id === 'cafe');
    if (r) r.n += 4;
    scores.sort((a, b) => b.n - a.n);
  }
  const best = scores[0];
  if (!best || best.n < 2) return null;
  const margin = best.n - (scores[1]?.n ?? 0);
  const confidence: Confidence = best.n >= 6 && margin >= 3 ? 'high' : best.n >= 3 ? 'medium' : 'low';
  return { value: best.id, confidence, evidence: best.words.map((w) => `"${w}"`) };
}

// ─── Country & language ─────────────────────────────────────────────────────

const COUNTRIES: { code: string; tld: RegExp; phone: RegExp; currency: RegExp; places?: RegExp }[] = [
  { code: 'SA', tld: /\.sa$/i, phone: /\+?966[\s-]?5\d|(^|[^\d])05\d{8}\b/, currency: /\bSAR\b|ر\.?\s?س|ريال سعودي|\bSR\b/, places: /\b(Saudi Arabia|KSA|Riyadh|Jeddah|Dammam|Makkah|Madinah|Khobar)\b|السعودية|المملكة العربية|الرياض|جدة|الدمام|مكة|المدينة المنورة|الخبر/ },
  { code: 'AE', tld: /\.ae$/i, phone: /\+?971[\s-]?5\d/, currency: /\bAED\b|درهم/ },
  { code: 'KW', tld: /\.kw$/i, phone: /\+?965[\s-]?\d/, currency: /\bKWD\b|د\.ك|دينار كويتي/ },
  { code: 'QA', tld: /\.qa$/i, phone: /\+?974[\s-]?\d/, currency: /\bQAR\b|ريال قطري/ },
  { code: 'BH', tld: /\.bh$/i, phone: /\+?973[\s-]?\d/, currency: /\bBHD\b|دينار بحريني/ },
  { code: 'OM', tld: /\.om$/i, phone: /\+?968[\s-]?\d/, currency: /\bOMR\b|ريال عماني/ },
  { code: 'EG', tld: /\.eg$/i, phone: /\+?20[\s-]?1\d/, currency: /\bEGP\b|جنيه/ },
  { code: 'JO', tld: /\.jo$/i, phone: /\+?962[\s-]?7\d/, currency: /\bJOD\b|دينار أردني/ },
];

function country($: Doc, host: string, html: string, ld: Record<string, unknown>[]): { code: string; evidence: string[] } | null {
  const text = html.slice(0, 600_000);
  const locale = $('meta[property="og:locale" i]').attr('content') ?? '';
  const ldCountry = ld.map((o) => str((o.address as Record<string, unknown> | undefined)?.addressCountry)).find(Boolean) ?? null;
  const best: { code: string; evidence: string[] }[] = [];
  for (const c of COUNTRIES) {
    const ev: string[] = [];
    if (c.tld.test(host)) ev.push(`domain .${host.split('.').pop()}`);
    if (c.phone.test(text)) ev.push('local phone number format');
    if (c.currency.test(text)) ev.push('local currency');
    if (c.places?.test(text)) ev.push('local place names');
    if (new RegExp(`_${c.code}\\b`, 'i').test(locale)) ev.push(`og:locale ${locale}`);
    if (ldCountry && ldCountry.toUpperCase().startsWith(c.code)) ev.push(`structured address ${ldCountry}`);
    if (ev.length) best.push({ code: c.code, evidence: ev });
  }
  best.sort((a, b) => b.evidence.length - a.evidence.length);
  return best[0] ?? null;
}

// ─── Entry point ────────────────────────────────────────────────────────────

export function detectIdentity(args: { $: Doc; html: string; url: string; platform: PlatformDetection; internalLinks: number }): BusinessIdentity {
  const { $, html, url, platform, internalLinks } = args;
  const ld = jsonLd($);
  const host = new URL(url).hostname;
  const text = bodyText($);
  const declared = clean($('html').attr('lang'));
  const share = arabicShare(text);
  const primary = share === null ? (declared?.slice(0, 2).toLowerCase() ?? null) : share >= 0.5 ? 'ar' : 'en';
  const type = websiteType($, html, ld, platform, internalLinks);

  return {
    brandName: brandName($, ld, host),
    siteTitle: clean($('head > title').first().text()) ? clip(clean($('head > title').first().text())!, 160) : null,
    description: clean($('meta[name="description" i]').attr('content') ?? $('meta[property="og:description" i]').attr('content'))
      ? clip(clean($('meta[name="description" i]').attr('content') ?? $('meta[property="og:description" i]').attr('content'))!, 300)
      : null,
    logo: findLogo($, ld, url),
    colors: cssColors($),
    websiteType: type,
    industry: industry($, ld, type.value),
    language: { primary, declared, arabicShare: share === null ? null : Math.round(share * 100) / 100 },
    country: country($, host, html, ld),
    contact: contactChannels($),
  };
}

export { normalizeText };
