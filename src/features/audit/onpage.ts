import * as cheerio from 'cheerio';
import type { OnPageData } from '@/types/audit';

const CTA_WORDS =
  /(get started|start now|book|order|buy|shop|contact|call us|call now|request|quote|sign up|register|subscribe|try|download|learn more|whatsapp|reserve|add to cart|get in touch|free trial|ابدأ|ابدا|احجز|اطلب|اشتر|تسوق|تسوّق|تواصل|اتصل|سجل|سجّل|اشترك|جرب|جرّب|حمل|حمّل|عرض سعر|واتساب|واتس اب|أضف|اضف للسلة|احصل)/i;
const CONTACT_WORDS = /(contact|get in touch|اتصل|تواصل|راسلنا)/i;
const WHATSAPP_HREF = /(wa\.me\/|api\.whatsapp\.com|web\.whatsapp\.com|whatsapp:\/\/|chat\.whatsapp\.com)/i;

const clean = (s: string | undefined | null) => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t.length ? t : null;
};
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * Read the server-delivered HTML of a page. This sees what a crawler sees
 * before JavaScript runs, so pages rendered entirely in the browser are
 * flagged (likelyClientRendered) and heuristic checks are skipped for them.
 */
export function analyzeHtml(html: string, pageUrl: string): OnPageData {
  const $ = cheerio.load(html);
  const isHttps = pageUrl.startsWith('https://');

  const title = clean($('head > title').first().text() || $('title').first().text());
  const metaDescription = clean($('meta[name="description" i]').attr('content'));
  const canonical = clean($('link[rel="canonical" i]').attr('href'));
  const robotsMeta = clean(
    $('meta[name="robots" i], meta[name="googlebot" i]')
      .map((_, el) => $(el).attr('content') ?? '')
      .get()
      .join(', '),
  );
  const lang = clean($('html').attr('lang'));
  const viewport = clean($('meta[name="viewport" i]').attr('content'));

  // Heading outline
  const levels = $('h1, h2, h3, h4, h5, h6')
    .map((_, el) => Number(el.tagName.slice(1)))
    .get();
  const h1Count = levels.filter((l) => l === 1).length;
  let headingOrderOk = true;
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] - levels[i - 1] > 1) headingOrderOk = false;
  }

  // Mixed content must be read before scripts are stripped below.
  const mixed: string[] = [];
  if (isHttps) {
    $('script[src], iframe[src], img[src], video[src], audio[src], source[src], embed[src], link[rel="stylesheet" i][href], form[action]').each(
      (_, el) => {
        const ref = $(el).attr('src') ?? $(el).attr('href') ?? $(el).attr('action') ?? '';
        if (/^http:\/\//i.test(ref.trim())) mixed.push(clip(ref.trim(), 110));
      },
    );
  }
  const scriptCount = $('script').length;

  // Images
  const images = $('img');
  const imagesMissingAlt = images.filter((_, el) => $(el).attr('alt') === undefined).length;

  // Navigation
  const navLinks = $('nav a[href], [role="navigation"] a[href]');
  const hasNavLandmark = $('nav, [role="navigation"]').length > 0;
  const headerLinkCount = $('header a[href]').length;

  // Contact signals
  const hrefs = $('a[href]')
    .map((_, el) => ($(el).attr('href') ?? '').trim())
    .get();
  const linkTexts = $('a[href]')
    .map((_, el) => `${$(el).text()} ${$(el).attr('href') ?? ''} ${$(el).attr('aria-label') ?? ''}`)
    .get();
  const contact = {
    tel: hrefs.some((h) => /^tel:/i.test(h)),
    email: hrefs.some((h) => /^mailto:/i.test(h)),
    whatsapp: hrefs.some((h) => WHATSAPP_HREF.test(h)),
    contactLink: linkTexts.some((t) => CONTACT_WORDS.test(t)),
    form: $('form').filter((_, el) => $(el).find('input[type="email"], input[type="tel"], textarea').length > 0).length > 0,
  };

  // Calls to action
  const ctaSet = new Set<string>();
  $('a[href], button, input[type="submit"], [role="button"]').each((_, el) => {
    const node = $(el);
    const label = clean(node.text() || node.attr('value') || node.attr('aria-label')) ?? '';
    if (!label || label.length > 60) return;
    const cls = `${node.attr('class') ?? ''}`;
    const looksLikeButton = el.tagName === 'button' || /(^|[\s_-])(btn|button|cta)([\s_-]|$)/i.test(cls);
    if (CTA_WORDS.test(label) && (looksLikeButton || el.tagName === 'a')) ctaSet.add(label);
  });

  // Visible text volume
  $('script, style, noscript, template, svg').remove();
  const text = clean($('body').text()) ?? '';
  const wordCount = text ? text.split(' ').length : 0;

  const appShell = $('#__next, #root, #app, #__nuxt, [data-reactroot], app-root').length > 0;
  const likelyClientRendered = wordCount < 40 && scriptCount >= 2 && (appShell || levels.length === 0);

  return {
    title: title ? clip(title, 200) : null,
    metaDescription: metaDescription ? clip(metaDescription, 400) : null,
    canonical: canonical ? clip(canonical, 300) : null,
    robotsMeta: robotsMeta ? clip(robotsMeta, 160) : null,
    lang,
    viewport: viewport ? clip(viewport, 160) : null,
    h1Count,
    headingCount: levels.length,
    headingOrderOk,
    wordCount,
    imageCount: images.length,
    imagesMissingAlt,
    navLinkCount: navLinks.length,
    hasNavLandmark,
    headerLinkCount,
    contact,
    ctaCount: ctaSet.size,
    ctaSamples: [...ctaSet].slice(0, 3).map((s) => clip(s, 40)),
    mixedContentCount: mixed.length,
    mixedContentSamples: mixed.slice(0, 3),
    scriptCount,
    likelyClientRendered,
  };
}
