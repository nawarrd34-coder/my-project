import type { Confidence, PlatformDetection, PlatformId } from '@/types/business';

/**
 * Platform fingerprints. Each signal is a public, technical marker (asset host,
 * platform global, response header, generator tag, DOM signature). Evidence is
 * reported in neutral technical form so it reads the same in both languages.
 *
 * weight 3 = specific to the platform, 2 = strong hint, 1 = weak hint.
 */
interface Signal {
  label: string;
  weight: 1 | 2 | 3;
  html?: RegExp;
  header?: [string, RegExp];
}

const SIGNALS: Record<Exclude<PlatformId, 'unknown'>, Signal[]> = {
  shopify: [
    { label: 'assets on cdn.shopify.com', weight: 3, html: /cdn\.shopify\.com/gi },
    { label: 'Shopify theme asset path /cdn/shop/', weight: 3, html: /\/cdn\/shop\/(files|products|t)\//gi },
    { label: 'window.Shopify global', weight: 3, html: /\bShopify\.(theme|shop|routes|locale)\b/g },
    { label: 'myshopify.com domain reference', weight: 2, html: /[a-z0-9-]+\.myshopify\.com/gi },
    { label: 'shopify-checkout-api-token meta', weight: 3, html: /shopify-checkout-api-token|shopify-digital-wallet/gi },
    { label: 'x-shopid response header', weight: 3, header: ['x-shopid', /.+/] },
    { label: 'powered-by: Shopify header', weight: 3, header: ['powered-by', /shopify/i] },
  ],
  salla: [
    { label: 'assets on cdn.salla.sa / salla.network', weight: 3, html: /(cdn\.salla\.(sa|network)|assets\.salla\.(sa|network)|salla\.network)/gi },
    { label: 'Salla Twilight theme engine', weight: 3, html: /@salla\.sa\/twilight|twilight-components|salla-twilight/gi },
    { label: '<salla-*> web components', weight: 3, html: /<salla-[a-z-]+/gi },
    { label: 'window.salla / salla.config', weight: 3, html: /\bsalla\.(config|event|api|cart)\b|window\.salla\b/g },
    { label: 'salla.sa link', weight: 1, html: /https?:\/\/(www\.)?salla\.sa\b/gi },
  ],
  zid: [
    { label: 'assets on media.zid.store / zid.store', weight: 3, html: /(media|cdn|assets)\.zid\.store/gi },
    { label: 'Zid storefront script', weight: 3, html: /zid\.store\/(js|themes|storefront)|zidthemes|zid-theme/gi },
    { label: 'zid.sa link', weight: 1, html: /https?:\/\/(www\.)?zid\.sa\b/gi },
    { label: 'Zid store identifier', weight: 2, html: /\b(zid_store_id|zidStoreId|window\.zid)\b/gi },
  ],
  woocommerce: [
    { label: 'WooCommerce plugin assets', weight: 3, html: /wp-content\/plugins\/woocommerce/gi },
    { label: 'woocommerce body/page classes', weight: 2, html: /class="[^"]*\bwoocommerce(-page|-js|-no-js)?\b/gi },
    { label: 'WooCommerce generator tag', weight: 3, html: /<meta[^>]+generator[^>]+WooCommerce/gi },
    { label: 'wc-ajax / wc-blocks endpoints', weight: 2, html: /wc-ajax=|wc-blocks?[-_]|wc_add_to_cart_params/gi },
  ],
  magento: [
    { label: 'text/x-magento-init scripts', weight: 3, html: /text\/x-magento-init/gi },
    { label: 'Magento_ module assets', weight: 3, html: /\/Magento_[A-Za-z]+\//g },
    { label: 'mage/ requirejs modules', weight: 2, html: /["']mage\/[a-z]/gi },
    { label: 'x-magento-* response header', weight: 3, header: ['x-magento-tags', /.+/] },
  ],
  bigcommerce: [
    { label: 'assets on bigcommerce.com CDN', weight: 3, html: /cdn\d*\.bigcommerce\.com/gi },
    { label: 'BigCommerce stencil', weight: 2, html: /stencil-utils|BCData/g },
  ],
  opencart: [
    { label: 'OpenCart route parameter', weight: 2, html: /index\.php\?route=(product|common|checkout)\//gi },
    { label: 'catalog/view/theme assets', weight: 3, html: /catalog\/view\/(theme|javascript)\//gi },
  ],
  prestashop: [
    { label: 'PrestaShop generator / globals', weight: 3, html: /<meta[^>]+generator[^>]+PrestaShop|\bprestashop\s*=\s*\{/gi },
    { label: 'PrestaShop modules', weight: 2, html: /\/modules\/ps_[a-z]+/gi },
  ],
  expandcart: [{ label: 'ExpandCart assets', weight: 3, html: /expandcart(cdn)?\.com|expandcart/gi }],
  youcan: [{ label: 'YouCan assets', weight: 3, html: /(cdn|static)\.youcan\.shop|youcan\.shop/gi }],
  wix: [
    { label: 'assets on static.wixstatic.com', weight: 3, html: /static\.wixstatic\.com|static\.parastorage\.com/gi },
    { label: 'Wix generator tag', weight: 3, html: /<meta[^>]+generator[^>]+Wix\.com/gi },
    { label: 'x-wix-request-id header', weight: 3, header: ['x-wix-request-id', /.+/] },
  ],
  squarespace: [
    { label: 'assets on static1.squarespace.com', weight: 3, html: /static1?\.squarespace\.com/gi },
    { label: 'Squarespace marker comment', weight: 3, html: /This is Squarespace\./g },
  ],
  webflow: [
    { label: 'data-wf-site attribute', weight: 3, html: /data-wf-(site|page)=/gi },
    { label: 'Webflow generator tag', weight: 3, html: /<meta[^>]+generator[^>]+Webflow/gi },
  ],
  wordpress: [
    { label: 'wp-content / wp-includes assets', weight: 2, html: /\/wp-(content|includes)\//gi },
    { label: 'WordPress generator tag', weight: 3, html: /<meta[^>]+generator[^>]+WordPress/gi },
    { label: 'wp-json REST link', weight: 2, html: /\/wp-json\//gi },
  ],
};

const FRAMEWORKS: [string, RegExp][] = [
  ['Next.js', /\/_next\/static\/|__NEXT_DATA__/],
  ['Nuxt', /\/_nuxt\/|__NUXT__/],
  ['Gatsby', /___gatsby|\/page-data\//],
  ['Angular', /\bng-version=/],
  ['Vue', /\bdata-v-[a-f0-9]{6,}/],
  ['Laravel', /laravel_session|csrf-token[^>]+content=/i],
  ['Remix', /__remixContext/],
  ['Astro', /astro-island|data-astro-cid/],
];

const confidenceFor = (score: number, distinct: number): Confidence | null => {
  if (score >= 5 && distinct >= 2) return 'high';
  if (score >= 3) return 'medium';
  if (score >= 1) return 'low';
  return null;
};

/**
 * Detect the website platform from the page HTML(s) and response headers.
 * `pages` may include several fetched pages; signals are counted across them.
 */
export function detectPlatform(pages: string[], headers: Record<string, string>): PlatformDetection {
  const html = pages.join('\n').slice(0, 6_000_000);
  const results: { id: PlatformId; score: number; evidence: string[]; distinct: number }[] = [];

  for (const [id, signals] of Object.entries(SIGNALS) as [Exclude<PlatformId, 'unknown'>, Signal[]][]) {
    let score = 0;
    let distinct = 0;
    const evidence: string[] = [];
    for (const s of signals) {
      if (s.html) {
        const n = (html.match(s.html) ?? []).length;
        if (n > 0) {
          score += s.weight;
          distinct += 1;
          evidence.push(n > 1 ? `${s.label} (×${n})` : s.label);
        }
      } else if (s.header) {
        const [name, re] = s.header;
        const v = headers[name];
        if (v && re.test(v)) {
          score += s.weight;
          distinct += 1;
          evidence.push(`${s.label}: ${v.slice(0, 40)}`);
        }
      }
    }
    if (score > 0) results.push({ id, score, evidence, distinct });
  }

  // A store platform beats the CMS it runs on.
  const wp = results.find((r) => r.id === 'wordpress');
  const woo = results.find((r) => r.id === 'woocommerce');
  if (wp && woo) woo.evidence.push(...wp.evidence.map((e) => `WordPress: ${e}`));
  const ranked = results.filter((r) => !(r.id === 'wordpress' && woo)).sort((a, b) => b.score - a.score);
  const frameworks = FRAMEWORKS.filter(([, re]) => re.test(html)).map(([name]) => name);
  const powered = headers['x-powered-by'];
  if (powered && !/shopify|salla|zid/i.test(powered)) frameworks.push(`x-powered-by: ${powered.slice(0, 30)}`);

  const top = ranked[0];
  if (!top) return { id: 'unknown', confidence: null, evidence: [], frameworks };
  const conf = confidenceFor(top.score, top.distinct);
  // A lone weak hint (e.g. a link to salla.sa) is not enough to name a platform.
  if (conf === 'low' && top.score < 2) {
    return { id: 'unknown', confidence: null, evidence: top.evidence.map((e) => `weak hint only: ${e}`), frameworks };
  }
  return { id: top.id, confidence: conf, evidence: top.evidence.slice(0, 6), frameworks };
}

export const STORE_PLATFORMS: PlatformId[] = ['salla', 'zid', 'shopify', 'woocommerce', 'magento', 'bigcommerce', 'opencart', 'prestashop', 'expandcart', 'youcan'];
