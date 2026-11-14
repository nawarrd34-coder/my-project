import type { JourneyAnalysis, SearchAnalysis } from '@/types/business';
import { absUrl, clean, type Doc } from './html';

const PAYMENTS: [string, RegExp][] = [
  ['mada', /\bmada\b|مدى/i],
  ['Apple Pay', /apple[\s-]?pay/i],
  ['Visa', /\bvisa\b/i],
  ['Mastercard', /master[\s-]?card/i],
  ['STC Pay', /stc[\s-]?pay/i],
  ['Tabby', /\btabby\b|تابي/i],
  ['Tamara', /\btamara\b|تمارا/i],
  ['PayPal', /paypal/i],
  ['Google Pay', /google[\s-]?pay/i],
  ['Cash on delivery', /cash on delivery|\bCOD\b|الدفع عند الاستلام/i],
  ['Bank transfer', /bank transfer|تحويل بنكي/i],
];

/** Read the customer journey signals from the pages fetched during the crawl. */
export function analyzeJourney(pages: Doc[]): JourneyAnalysis {
  const hay = pages
    .map(($) => {
      const imgs = $('img').map((_, el) => `${$(el).attr('alt') ?? ''} ${$(el).attr('src') ?? ''}`).get().join(' ');
      const links = $('a[href]').map((_, el) => `${$(el).text()} ${$(el).attr('href') ?? ''}`).get().join(' ');
      return `${clean($('body').text()) ?? ''} ${imgs} ${links} ${$('footer').html() ?? ''}`;
    })
    .join('\n')
    .slice(0, 2_000_000);
  const home = pages[0];
  const navLinks = home ? home('header nav a, nav[aria-label] a, header a').length : 0;

  return {
    cartLink: /href="[^"]*\/(cart|basket)\b|السلة|سلة المشتريات|عربة التسوق|\bcart\b/i.test(hay) || (home ? home('salla-cart-summary, [class*="cart" i]').length > 0 : false),
    accountLink: /\/(account|login|signin|my-account)\b|تسجيل الدخول|حسابي|دخول/i.test(hay),
    paymentMethods: PAYMENTS.filter(([, re]) => re.test(hay)).map(([name]) => name),
    deliveryInfo: /shipping|delivery|الشحن|التوصيل|توصيل/i.test(hay),
    returnPolicy: /return policy|refund|returns|سياسة الاسترجاع|الاسترجاع|الاستبدال|استرداد/i.test(hay),
    privacyPolicy: /privacy|الخصوصية/i.test(hay),
    trust: {
      maroof: /maroof\.sa|معروف/i.test(hay),
      commercialRegistration: /commercial registration|\bCR\s?(no|number)?\.?\s?:?\s?\d{6,}|السجل التجاري|سجل تجاري/i.test(hay),
      vatNumber: /\bVAT\b|الرقم الضريبي|ضريبة القيمة المضافة/i.test(hay),
      businessCenter: /business\.sa|eauthenticate|المركز السعودي للأعمال|منصة الأعمال|توثيق/i.test(hay),
    },
    reviews: /aggregateRating|reviews?\b|تقييم|تقييمات|آراء العملاء|مراجعات/i.test(hay),
    navLinks,
  };
}

const SEARCH_INPUT = 'input[type="search"], input[name="q"], input[name="s"], input[name="search"], input[name="query"], input[name="keyword"], input[name="term"], input[placeholder*="search" i], input[placeholder*="بحث"], input[aria-label*="search" i], input[aria-label*="بحث"]';

/** Find the site's search field in the server-delivered HTML. */
export function searchInterface($: Doc, base: string): Omit<SearchAnalysis, 'tests' | 'visibleDesktop' | 'visibleMobile' | 'autocomplete'> & { hidden: Record<string, string>; method: string } {
  const input = $(SEARCH_INPUT).first();
  if (input.length) {
    const form = input.closest('form');
    const hidden: Record<string, string> = {};
    form.find('input[type="hidden"][name]').each((_, el) => {
      const name = $(el).attr('name')!;
      if (!/token|nonce|csrf|_wpnonce/i.test(name)) hidden[name] = $(el).attr('value') ?? '';
    });
    return {
      present: true,
      source: 'html',
      action: form.length ? (absUrl(form.attr('action') || base, base) ?? base) : null,
      method: (form.attr('method') ?? 'get').toLowerCase(),
      inputName: input.attr('name') ?? null,
      placeholder: clean(input.attr('placeholder')),
      hidden,
    };
  }
  // Platform search components render their input with JavaScript.
  const component = $('salla-search, [class*="search-component" i], [data-search], button[aria-label*="search" i], button[aria-label*="بحث"], a[href*="/search"]').first();
  if (component.length) {
    return { present: true, source: 'component', action: null, method: 'get', inputName: null, placeholder: null, hidden: {} };
  }
  return { present: false, source: null, action: null, method: 'get', inputName: null, placeholder: null, hidden: {} };
}

export const NO_RESULTS = /no (products|results)( were)? found|no results|nothing (was )?found|did not match any|0 results|لا توجد نتائج|لم يتم العثور|لم نجد|لا يوجد منتجات|لا توجد منتجات|لا يوجد نتائج|عذرا|عذراً/i;
