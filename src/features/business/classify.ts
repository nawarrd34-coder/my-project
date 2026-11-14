import type {
  BusinessIdentity,
  BusinessModel,
  CatalogAnalysis,
  Confidence,
  DesignAnalysis,
  Evidence,
  IndustryId,
  ModelSignal,
  PageKind,
  PlatformDetection,
  SiteCategory,
  SiteClassification,
  WebsiteType,
} from '@/types/business';
import { clean, clip, jsonLd, ldTypes, str, type Doc } from './html';
import { STORE_PLATFORMS } from './platform';

/**
 * Website classification: what kind of website this is and how the business
 * turns visitors into customers. Every conclusion carries the evidence it was
 * drawn from (page, place, value). Nothing here is guessed from the domain
 * name; when signals are weak the result is marked uncertain so the user can
 * confirm it.
 */

export interface ClassifyPage {
  url: string;
  kind: PageKind;
  $: Doc;
}

const TRANSACTIONAL: BusinessModel[] = ['direct_sales', 'online_booking', 'appointments', 'subscription', 'quotation'];

const RE = {
  addToCart: /add[\s-]?to[\s-]?(cart|bag|basket)|أضف (الى|إلى|ل)ل?سلة|اضف (الى|إلى|ل)ل?سلة|إضافة (الى|إلى|ل)ل?سلة|أضف للسلة|اضف للسلة|اشتر الآن|اشتري الآن|buy now/i,
  reservation: /reserve a table|book (a|your) (table|trip|tour|room|stay|package)|book your (trip|tour|stay)|check availability|حجز طاولة|احجز طاولت?ك|احجز رحلت?ك|احجز الرحلة|احجز باقت?ك|احجز إقامت?ك|تحقق من التوفر/i,
  appointment: /book (an |your )?appointment|schedule (a |your )?(call|consultation|meeting|visit|demo)|book a (consultation|call|session|demo)|احجز موعد|احجز موعدك|حجز موعد|حجز المواعيد|احجز استشارة|احجز استشارتك|حجز استشارة|احجز جلسة/i,
  bookingWidget: /calendly\.com|setmore\.com|simplybook\.|acuityscheduling\.com|fresha\.com|booksy\.com|vezeeta\.com|cal\.com\/|zcal\.co|youcanbook\.me|opentable\.com|sevenrooms\.com|resy\.com/i,
  quote: /request (a |your )?(quote|quotation|proposal|estimate)|get (a |your )?(free )?(quote|quotation|estimate)|اطلب عرض سعر|طلب عرض سعر|احصل على عرض سعر|طلب تسعيرة|اطلب تسعيرة|اطلب تسعير|طلب تسعير/i,
  subscription: /per month|\/\s?mo(nth)?\b|monthly plan|annual plan|billed (monthly|annually|yearly)|free trial|start (your )?free|try (it )?free|شهري[اًا]?\s|\/\s?شهر|سنوي[اًا]?\s|تجربة مجانية|ابدأ مجان[اًا]|اشترك الآن|خطط الأسعار/i,
  hours: /opening hours|working hours|business hours|open (daily|every day)|ساعات العمل|أوقات العمل|مواعيد العمل|أوقات الدوام|ساعات الدوام/i,
  contactCta: /contact us|get in touch|talk to us|request (a )?consultation|get (a )?(free )?consultation|تواصل معنا|اتصل بنا|اطلب استشارة|احصل على استشارة|استشارة مجانية|راسلنا/i,
  services: /^(our )?services$|what we (do|offer)|practice areas|our expertise|خدماتنا|الخدمات|خدمات|مجالات (عملنا|العمل|الممارسة)|ماذا نقدم|حلولنا/i,
  b2b: /\b(b2b|for businesses|for companies|enterprises?|corporate clients|organizations|for teams|government entities)\b|للشركات|الشركات والمؤسسات|للمؤسسات|قطاع الأعمال|الجهات الحكومية|القطاع الحكومي|عملائنا من الشركات/gi,
  b2c: /\b(for you and your family|for him|for her|shop now|your home|perfect gift)\b|تسوق الآن|تسوقي الآن|لك ولعائلتك|للأفراد|الأفراد|هديتك|هدية مثالية|اطلبه الآن/gi,
  map: /google\.[a-z.]+\/maps|maps\.google\.|goo\.gl\/maps|maps\.app\.goo\.gl|maps\.apple\.com/i,
};

/** Stock marketing phrases that say little about the business. Matched on the homepage text only. */
const GENERIC_PHRASES: RegExp[] = [
  /نقدم (لكم )?أفضل (الخدمات|الحلول)/,
  /أفضل الخدمات/,
  /حلول متكاملة/,
  /خدمات متميزة/,
  /(جودة|بجودة) عالية/,
  /رواد في/,
  /نسعى دائم[اًا]/,
  /رضا (العملاء|عملائنا) (هو )?(هدفنا|أولويتنا)/,
  /\bwe provide the best\b/i,
  /\bbest (services|solutions)\b/i,
  /\bhigh[- ]quality (services|solutions|products)\b/i,
  /\binnovative solutions\b/i,
  /\bone[- ]stop (shop|solution)\b/i,
  /\bcustomer satisfaction is our (top )?priority\b/i,
  /\bworld[- ]class\b/i,
  /\bleading (company|provider)\b/i,
];

const INDUSTRY_CATEGORY: Partial<Record<IndustryId, SiteCategory>> = {
  legal: 'law',
  travel: 'tourism',
  restaurant: 'restaurant',
  cafe: 'restaurant',
  real_estate: 'real_estate',
  medical: 'medical',
  marketing: 'agency',
  technology: 'technology',
  consulting: 'consulting',
  education: 'education',
  construction: 'construction',
  finance: 'professional_services',
  logistics: 'professional_services',
  events: 'professional_services',
};

const TYPE_CATEGORY: Partial<Record<WebsiteType, SiteCategory>> = {
  ecommerce: 'ecommerce',
  restaurant: 'restaurant',
  portfolio: 'portfolio',
  corporate: 'corporate',
  service: 'professional_services',
};

/** Categories whose online ordering or booking does not make them a plain online store. */
const KEEP_WITH_CART: SiteCategory[] = ['restaurant', 'tourism', 'education'];

const where = (kind: PageKind) => (kind === 'home' ? 'homepage' : `${kind} page`);

function textOf($: Doc): string {
  return (clean($('body').text()) ?? '').slice(0, 400_000);
}

function linkTexts($: Doc): { text: string; href: string }[] {
  return $('a[href], button')
    .map((_, el) => ({ text: (clean($(el).text()) ?? clean($(el).attr('aria-label')) ?? '').slice(0, 80), href: $(el).attr('href') ?? '' }))
    .get();
}

function firstMatch(text: string, re: RegExp): string | null {
  const m = text.match(new RegExp(re.source, re.flags.replace('g', '')));
  return m ? clip(m[0].trim(), 80) : null;
}

// ─── Business model ─────────────────────────────────────────────────────────

function modelSignals(pages: ClassifyPage[], platform: PlatformDetection, catalog: CatalogAnalysis | null, identity: BusinessIdentity): ModelSignal[] {
  const acc = new Map<BusinessModel, ModelSignal>();
  const add = (model: BusinessModel, n: number, ev: Evidence) => {
    const s = acc.get(model) ?? { model, strength: 0, evidence: [] };
    s.strength += n;
    if (s.evidence.length < 5 && !s.evidence.some((e) => e.value === ev.value && e.url === ev.url)) s.evidence.push(ev);
    acc.set(model, s);
  };
  const home = pages[0];

  if (STORE_PLATFORMS.includes(platform.id)) add('direct_sales', 6, { url: home.url, where: 'platform signature', value: platform.id });
  if (catalog && catalog.productUrlsDiscovered > 0) add('direct_sales', 2, { url: home.url, where: 'product links', value: `${catalog.productUrlsDiscovered} product pages` });

  const seen = new Set<string>();
  const once = (key: string) => (seen.has(key) ? false : (seen.add(key), true));

  for (const p of pages) {
    const { $, url, kind } = p;
    const text = textOf($);
    const links = linkTexts($);
    const html = $.html().slice(0, 600_000);
    const types = new Set(jsonLd($).flatMap(ldTypes));

    const cart = links.find((l) => RE.addToCart.test(l.text));
    if (cart && once('cart')) add('direct_sales', 4, { url, where: `${where(kind)} button`, value: cart.text });
    if (types.has('offer') && types.has('product') && once('offer')) add('direct_sales', 3, { url, where: 'JSON-LD', value: 'Product with Offer' });

    const widget = html.match(RE.bookingWidget);
    if (widget && once(`w-${widget[0]}`)) {
      const table = /opentable|sevenrooms|resy/i.test(widget[0]);
      add(table ? 'online_booking' : 'appointments', 6, { url, where: `${where(kind)} embed`, value: widget[0] });
    }
    const appt = links.find((l) => RE.appointment.test(l.text)) ?? null;
    if (appt && once('appt')) add('appointments', 4, { url, where: `${where(kind)} link`, value: appt.text });
    else if (RE.appointment.test(text) && once('appt-t')) add('appointments', 2, { url, where: where(kind), value: firstMatch(text, RE.appointment) ?? '' });

    const resv = links.find((l) => RE.reservation.test(l.text)) ?? null;
    if (resv && once('resv')) add('online_booking', 4, { url, where: `${where(kind)} link`, value: resv.text });
    else if (RE.reservation.test(text) && once('resv-t')) add('online_booking', 2, { url, where: where(kind), value: firstMatch(text, RE.reservation) ?? '' });
    if (['reservation', 'foodestablishmentreservation', 'lodgingreservation', 'touristtrip'].some((t) => types.has(t)) && once('resv-ld')) add('online_booking', 3, { url, where: 'JSON-LD', value: 'Reservation / TouristTrip' });
    if (kind === 'booking' && once('booking-page')) add(RE.reservation.test(text) ? 'online_booking' : 'appointments', 3, { url, where: 'booking page', value: url });
    if ($('form input[type="date"], form input[type="datetime-local"], form input[type="time"]').length && once('date')) {
      add(RE.reservation.test(text) ? 'online_booking' : 'appointments', 2, { url, where: `${where(kind)} form`, value: 'date / time field' });
    }

    const quote = links.find((l) => RE.quote.test(l.text)) ?? null;
    if (quote && once('quote')) add('quotation', 4, { url, where: `${where(kind)} link`, value: quote.text });
    else if (RE.quote.test(text) && once('quote-t')) add('quotation', 2, { url, where: where(kind), value: firstMatch(text, RE.quote) ?? '' });

    if (RE.subscription.test(text) && once(`sub-${kind}`)) add('subscription', kind === 'pricing' ? 4 : 2, { url, where: where(kind), value: firstMatch(text, RE.subscription) ?? '' });
    if (kind === 'pricing' && once('pricing-page')) add('subscription', 1, { url, where: 'pricing page', value: url });

    if (($('iframe[src]').filter((_, el) => RE.map.test($(el).attr('src') ?? '')).length || links.some((l) => RE.map.test(l.href))) && once('map')) {
      add('physical_visit', 3, { url, where: `${where(kind)} map`, value: 'Google / Apple Maps link or embed' });
    }
    if ((RE.hours.test(text) || jsonLd($).some((o) => o.openingHours || o.openingHoursSpecification)) && once('hours')) {
      add('physical_visit', 2, { url, where: where(kind), value: firstMatch(text, RE.hours) ?? 'openingHours (JSON-LD)' });
    }

    const wa = links.filter((l) => /wa\.me\/|api\.whatsapp\.com|whatsapp:\/\//i.test(l.href)).length;
    if (wa && once('wa')) add('direct_communication', 2, { url, where: `${where(kind)} links`, value: `${wa} WhatsApp link${wa > 1 ? 's' : ''}` });
    const tel = links.filter((l) => /^tel:/i.test(l.href)).length;
    if (tel && once('tel')) add('direct_communication', 1, { url, where: `${where(kind)} links`, value: `${tel} phone link${tel > 1 ? 's' : ''}` });

    const forms = $('form').filter((_, el) => $(el).find('input[type="email"], input[type="tel"], textarea').length > 0 && !$(el).find('input[type="search"]').length).length;
    if (forms && once(`form-${kind}`)) add('lead_generation', 2, { url, where: `${where(kind)} form`, value: `${forms} enquiry form${forms > 1 ? 's' : ''}` });
    const cta = links.find((l) => RE.contactCta.test(l.text));
    if (cta && once('contact-cta')) add('lead_generation', 2, { url, where: `${where(kind)} link`, value: cta.text });
  }
  if (identity.contact.contactPage && !acc.get('lead_generation')) add('lead_generation', 1, { url: home.url, where: 'navigation', value: 'contact page link' });

  return [...acc.values()].sort((a, b) => b.strength - a.strength);
}

function pickModel(signals: ModelSignal[]): SiteClassification['model'] {
  if (!signals.length) return { primary: null, secondary: [], hybrid: false, confidence: null, signals };
  const [top, second] = signals;
  const secondary = signals.slice(1).filter((s) => s.strength >= 3).slice(0, 3).map((s) => s.model);
  const hybrid = !!second && TRANSACTIONAL.includes(top.model) && TRANSACTIONAL.includes(second.model) && second.strength >= 4 && second.strength >= top.strength * 0.6;
  const margin = top.strength - (second?.strength ?? 0);
  const confidence: Confidence = top.strength >= 8 && margin >= 3 ? 'high' : top.strength >= 4 ? 'medium' : 'low';
  return { primary: top.model, secondary, hybrid, confidence, signals };
}

// ─── Category ───────────────────────────────────────────────────────────────

function pickCategory(
  identity: BusinessIdentity,
  platform: PlatformDetection,
  model: SiteClassification['model'],
  pages: ClassifyPage[],
): { category: SiteClassification['category']; uncertain: boolean } {
  const home = pages[0];
  const ev: Evidence[] = [];
  const candidates: { cat: SiteCategory; conf: Confidence; ev: Evidence[] }[] = [];
  const type = identity.websiteType;
  const ind = identity.industry;
  const sales = model.signals.find((s) => s.model === 'direct_sales')?.strength ?? 0;
  const subs = model.signals.find((s) => s.model === 'subscription')?.strength ?? 0;
  const store = STORE_PLATFORMS.includes(platform.id) || (type.value === 'ecommerce' && type.confidence !== 'low') || sales >= 8;

  const indCat = ind ? INDUSTRY_CATEGORY[ind.value] : undefined;
  const indEv: Evidence[] = ind ? [{ url: home.url, where: 'homepage title, headings and navigation', value: `industry "${ind.value}" (${ind.evidence.join(', ')})` }] : [];
  const typeEv: Evidence[] = [{ url: home.url, where: 'homepage', value: `website type "${type.value}" (${type.evidence.join(', ') || 'no strong signal'})` }];

  if (store) {
    const storeEv: Evidence[] = [
      ...(STORE_PLATFORMS.includes(platform.id) ? [{ url: home.url, where: 'platform signature', value: platform.id }] : []),
      ...(model.signals.find((s) => s.model === 'direct_sales')?.evidence.slice(0, 2) ?? []),
    ];
    if (indCat && KEEP_WITH_CART.includes(indCat)) candidates.push({ cat: indCat, conf: ind!.confidence === 'low' ? 'medium' : ind!.confidence, ev: [...indEv, ...storeEv] });
    candidates.push({ cat: 'ecommerce', conf: STORE_PLATFORMS.includes(platform.id) || sales >= 10 ? 'high' : 'medium', ev: storeEv.length ? storeEv : typeEv });
  }
  if (indCat) {
    let cat = indCat;
    if (cat === 'technology' && subs >= 4) cat = 'saas';
    candidates.push({ cat, conf: ind!.confidence, ev: indEv });
  } else if (subs >= 5 && pages.some((p) => p.kind === 'pricing')) {
    candidates.push({ cat: 'saas', conf: 'medium', ev: model.signals.find((s) => s.model === 'subscription')!.evidence.slice(0, 2) });
  }
  const typeCat = TYPE_CATEGORY[type.value];
  if (typeCat && !candidates.some((c) => c.cat === typeCat)) candidates.push({ cat: typeCat, conf: type.confidence === 'high' ? 'medium' : 'low', ev: typeEv });
  if (ind && !indCat && !store) {
    // A product industry without a shop (e.g. a perfume brand site) reads as a company site.
    candidates.push({ cat: 'corporate', conf: 'low', ev: indEv });
  }

  const order: Record<Confidence, number> = { high: 3, medium: 2, low: 1 };
  candidates.sort((a, b) => order[b.conf] - order[a.conf]);
  const best = candidates[0];
  if (!best) {
    return {
      category: { value: 'other', confidence: 'low', evidence: typeEv, alternatives: [] },
      uncertain: true,
    };
  }
  ev.push(...best.ev);
  const alternatives = [...new Set(candidates.slice(1).map((c) => c.cat).filter((c) => c !== best.cat))].slice(0, 3);
  const close = candidates[1] && candidates[1].cat !== best.cat && order[candidates[1].conf] === order[best.conf];
  return {
    category: { value: best.cat, confidence: best.conf, evidence: ev.slice(0, 5), alternatives },
    uncertain: best.conf === 'low' || !!close || best.cat === 'other',
  };
}

// ─── Services, audience, conversion ─────────────────────────────────────────

function services(pages: ClassifyPage[]): { name: string; source: string }[] {
  const out = new Map<string, string>();
  const push = (name: string | null, source: string) => {
    const n = clean(name);
    if (!n || n.length < 3 || n.length > 60 || out.size >= 8) return;
    if (RE.services.test(n) || /^(read more|learn more|more|المزيد|اقرأ المزيد|عرض المزيد)$/i.test(n)) return;
    const key = n.toLowerCase();
    if (![...out.keys()].some((k) => k.toLowerCase() === key)) out.set(n, source);
  };
  for (const p of pages) {
    const { $ } = p;
    // Structured data first: Service items and offer catalogues.
    for (const o of jsonLd($)) {
      if (ldTypes(o).includes('service')) push(str(o.name), 'JSON-LD Service');
      const cat = o.hasOfferCatalog as Record<string, unknown> | undefined;
      const items = (cat?.itemListElement as unknown[] | undefined) ?? [];
      for (const it of items) {
        const item = (it as Record<string, unknown>)?.itemOffered as Record<string, unknown> | undefined;
        push(str(item?.name ?? (it as Record<string, unknown>)?.name), 'JSON-LD offer catalogue');
      }
    }
    // A section headed "Our services" (or the services page itself): its card headings.
    const headings = $('h1, h2, h3').filter((_, el) => RE.services.test(clean($(el).text()) ?? ''));
    headings.slice(0, 2).each((_, h) => {
      const section = $(h).closest('section, [class*="service" i], [id*="service" i], main > div');
      section.find('h3, h4').slice(0, 10).each((__, el) => push($(el).text(), `${where(p.kind)} services section`));
      // Services written as a short list right after the heading.
      $(h).nextAll('ul, ol').first().children('li').slice(0, 10).each((__, el) => push($(el).text(), `${where(p.kind)} services list`));
    });
    if (p.kind === 'services') $('main h2, main h3, article h2, article h3').slice(0, 10).each((_, el) => push($(el).text(), 'services page'));
    // Navigation sub-menu under a "Services" item.
    $('nav li, header li').each((_, li) => {
      const label = clean($(li).children('a, button, span').first().text());
      if (label && RE.services.test(label)) $(li).find('ul a').slice(0, 10).each((__, a) => push($(a).text(), 'navigation menu'));
    });
  }
  return [...out.entries()].map(([name, source]) => ({ name, source }));
}

function audience(pages: ClassifyPage[], isStore: boolean): SiteClassification['audience'] {
  const home = pages[0];
  const text = pages.map((p) => textOf(p.$)).join(' ').slice(0, 800_000);
  const b2b = [...new Set((text.match(RE.b2b) ?? []).map((s) => s.trim()))];
  const b2c = [...new Set((text.match(RE.b2c) ?? []).map((s) => s.trim()))];
  const evidence = [...b2b.slice(0, 2), ...b2c.slice(0, 2)].map((v) => ({ url: home.url, where: 'page wording', value: `"${v}"` }));
  if (isStore) {
    return { value: b2b.length >= 2 ? 'both' : 'consumers', confidence: b2b.length >= 2 ? 'low' : 'medium', evidence: evidence.length ? evidence : [{ url: home.url, where: 'online store', value: 'products sold directly online' }] };
  }
  if (!b2b.length && !b2c.length) return null;
  if (b2b.length && b2c.length) return { value: 'both', confidence: 'low', evidence };
  return { value: b2b.length ? 'businesses' : 'consumers', confidence: Math.max(b2b.length, b2c.length) >= 2 ? 'medium' : 'low', evidence };
}

const CTA_FOR: Record<BusinessModel, RegExp> = {
  direct_sales: new RegExp(`${RE.addToCart.source}|shop now|shop the collection|تسوق الآن|تسوقي الآن|اطلب الآن|تصفح المنتجات`, 'i'),
  online_booking: RE.reservation,
  appointments: RE.appointment,
  quotation: RE.quote,
  subscription: /sign up|get started|start (free|trial)|اشترك|ابدأ الآن|سجل الآن|جرب مجان/i,
  physical_visit: /directions|visit us|زورونا|الموقع على الخريطة|اتجاهات/i,
  direct_communication: /whatsapp|واتساب|اتصل|call us/i,
  lead_generation: RE.contactCta,
};

function conversion(pages: ClassifyPage[], model: SiteClassification['model'], design: DesignAnalysis): SiteClassification['conversion'] {
  if (!model.primary) return null;
  const re = CTA_FOR[model.primary];
  const evidence: Evidence[] = [];
  let label: string | null = null;
  if (design.primaryCta && re.test(design.primaryCta.text)) {
    label = design.primaryCta.text;
    evidence.push({ url: pages[0].url, where: 'most prominent button on the homepage', value: label, screenshot: 'desktop' });
  } else {
    for (const p of pages) {
      const hit = linkTexts(p.$).find((l) => l.text && re.test(l.text));
      if (hit) {
        label = hit.text;
        evidence.push({ url: p.url, where: `${where(p.kind)} link or button`, value: hit.text });
        break;
      }
    }
  }
  if (!label) evidence.push(...model.signals[0].evidence.slice(0, 1));
  return { action: model.primary, label, evidence };
}

// ─── Entry point ────────────────────────────────────────────────────────────

export function classifySite(args: {
  pages: ClassifyPage[];
  identity: BusinessIdentity;
  platform: PlatformDetection;
  catalog: CatalogAnalysis | null;
  design: DesignAnalysis;
  homepageProducts: number;
}): SiteClassification {
  const { pages, identity, platform, catalog, design, homepageProducts } = args;
  const home = pages[0];
  const signals = modelSignals(pages, platform, catalog, identity);
  const model = pickModel(signals);
  const { category, uncertain } = pickCategory(identity, platform, model, pages);

  const $ = home.$;
  const homeText = `${$('h1, h2, h3, p').map((_, el) => $(el).text()).get().join(' \n ')}`.slice(0, 200_000);
  const generic = [...new Set(GENERIC_PHRASES.map((re) => homeText.match(re)?.[0]).filter((m): m is string => !!m))].slice(0, 6);
  const allTypes = [...new Set(pages.flatMap((p) => jsonLd(p.$).flatMap(ldTypes)))].slice(0, 16);

  return {
    category,
    uncertain,
    model,
    services: category.value === 'ecommerce' ? [] : services(pages),
    audience: audience(pages, category.value === 'ecommerce'),
    conversion: conversion(pages, model, design),
    signals: {
      ldTypes: allTypes,
      openGraph: !!($('meta[property="og:title" i]').attr('content') && $('meta[property="og:image" i]').attr('content')),
      mapEmbed: model.signals.some((s) => s.model === 'physical_visit' && s.evidence.some((e) => /map/.test(e.where))),
      openingHours: model.signals.some((s) => s.model === 'physical_visit' && s.evidence.some((e) => !/map/.test(e.where))),
      address: pages.some((p) => p.$('address').length > 0 || jsonLd(p.$).some((o) => !!o.address)),
      forms: pages.reduce((n, p) => n + p.$('form').filter((_, el) => p.$(el).find('input[type="email"], input[type="tel"], textarea').length > 0).length, 0),
      dateInputs: pages.some((p) => p.$('form input[type="date"], form input[type="datetime-local"], form input[type="time"]').length > 0),
      genericPhrases: generic,
      homepageProducts,
    },
  };
}
