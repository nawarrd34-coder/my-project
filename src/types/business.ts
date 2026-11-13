import type { Basis, Params, Severity } from './audit';

/**
 * Business-level analysis. Everything here comes from public pages fetched
 * during the scan (HTML, headers, sitemap, image headers) or from a rendered
 * pass in headless Chromium. Fields are null / "not tested" when the evidence
 * was not available; nothing is estimated in their place.
 */
export type Confidence = 'high' | 'medium' | 'low';

export type WebsiteType = 'ecommerce' | 'corporate' | 'restaurant' | 'service' | 'portfolio' | 'booking' | 'landing' | 'other';

export type PlatformId =
  | 'salla'
  | 'zid'
  | 'shopify'
  | 'woocommerce'
  | 'magento'
  | 'bigcommerce'
  | 'opencart'
  | 'prestashop'
  | 'expandcart'
  | 'youcan'
  | 'wix'
  | 'squarespace'
  | 'webflow'
  | 'wordpress'
  | 'unknown';

export type IndustryId =
  | 'fashion'
  | 'beauty'
  | 'perfume'
  | 'jewelry'
  | 'electronics'
  | 'home'
  | 'food'
  | 'restaurant'
  | 'cafe'
  | 'health'
  | 'kids'
  | 'sports'
  | 'books'
  | 'gifts'
  | 'automotive'
  | 'real_estate'
  | 'education'
  | 'technology'
  | 'marketing'
  | 'consulting'
  | 'construction'
  | 'travel'
  | 'events'
  | 'medical'
  | 'legal'
  | 'finance'
  | 'logistics';

export type PageKind = 'home' | 'product' | 'category' | 'about' | 'contact' | 'search' | 'policy' | 'blog' | 'other';

export interface Detected<T> {
  value: T;
  confidence: Confidence;
  evidence: string[];
}

export interface PlatformDetection {
  id: PlatformId;
  /** null when no platform could be confirmed. */
  confidence: Confidence | null;
  evidence: string[];
  /** Front-end frameworks seen (not platforms): e.g. Next.js, Nuxt. */
  frameworks: string[];
}

export interface BrandColor {
  hex: string;
  source: 'theme-color' | 'css' | 'rendered';
  /** Relative prominence 0–1 within its source. */
  weight: number;
}

export interface ContactChannels {
  phone: boolean;
  email: boolean;
  whatsapp: boolean;
  contactPage: boolean;
  form: boolean;
  social: string[];
}

export interface BusinessIdentity {
  brandName: { value: string; source: string } | null;
  siteTitle: string | null;
  description: string | null;
  /** dataUri is a small raster copy fetched for the PDF (never SVG). */
  logo: { url: string; source: string; dataUri?: string } | null;
  colors: BrandColor[];
  websiteType: Detected<WebsiteType>;
  industry: Detected<IndustryId> | null;
  language: { primary: string | null; declared: string | null; arabicShare: number | null };
  country: { code: string; evidence: string[] } | null;
  contact: ContactChannels;
}

export interface CrawledPage {
  url: string;
  kind: PageKind;
  status: number | null;
  ok: boolean;
}

export interface CrawlCoverage {
  pagesAnalyzed: number;
  requests: number;
  robots: 'found' | 'missing' | 'error';
  /** Discovered URLs we skipped because robots.txt disallows them. */
  robotsBlocked: number;
  sitemap: { found: boolean; files: number; urls: number; productUrls: number; categoryUrls: number };
  pages: CrawledPage[];
  /** true when the page or request budget ended the crawl early. */
  budgetReached: boolean;
  durationMs: number;
}

export interface ProductSample {
  url: string;
  name: string | null;
  image: string | null;
  imageCount: number;
  price: string | null;
  currency: string | null;
  descriptionLength: number;
  availability: string | null;
  addToCart: boolean;
  related: boolean;
  source: 'json-ld' | 'microdata' | 'open-graph' | 'html' | 'platform-json';
}

export interface CatalogAnalysis {
  /** Unique product page URLs seen in links, sitemaps or the platform feed. */
  productUrlsDiscovered: number;
  productPagesAnalyzed: number;
  /** Only set when the full catalogue was enumerated from a complete source. */
  catalogTotal: { value: number; verified: boolean; source: 'shopify-products-json' | 'sitemap' } | null;
  products: ProductSample[];
  categories: { count: number; names: string[] };
}

export interface BannerImage {
  src: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  ratio: number | null;
  bytes: number | null;
  format: string | null;
  responsive: boolean;
  mobileVariant: boolean;
  inSlider: boolean;
  linked: boolean;
  /** true when width/height come from the image file itself. */
  measured: boolean;
}

export interface BannerAnalysis {
  count: number;
  sliders: number;
  banners: BannerImage[];
}

export interface SearchTest {
  query: string;
  kind: 'representative' | 'no_result';
  status: 'ok' | 'failed' | 'blocked_by_robots' | 'skipped';
  resultCount: number | null;
  relevantCount: number | null;
  noResultMessage: boolean | null;
  url: string | null;
  via: 'http' | 'browser';
}

export interface SearchAnalysis {
  present: boolean;
  /** Where the field was found: server HTML, a platform component, or the rendered page. */
  source: 'html' | 'component' | 'rendered' | null;
  action: string | null;
  inputName: string | null;
  placeholder: string | null;
  visibleDesktop: boolean | null;
  visibleMobile: boolean | null;
  autocomplete: boolean | null;
  tests: SearchTest[];
}

export interface JourneyAnalysis {
  cartLink: boolean;
  accountLink: boolean;
  paymentMethods: string[];
  deliveryInfo: boolean;
  returnPolicy: boolean;
  privacyPolicy: boolean;
  trust: { maroof: boolean; commercialRegistration: boolean; vatNumber: boolean; businessCenter: boolean };
  reviews: boolean;
  navLinks: number;
}

export interface DesignAnalysis {
  rendered: boolean;
  screenshots: { desktop: string | null; mobile: string | null };
  fonts: { family: string; share: number }[];
  sizes: { h1: number | null; h2: number | null; body: number | null; mobileBody: number | null };
  palette: string[];
  primaryCta: { text: string; contrast: number | null; aboveFoldDesktop: boolean; aboveFoldMobile: boolean } | null;
  mobile: { horizontalOverflow: boolean; smallTapTargets: number; tinyText: number } | null;
  heroText: { text: string; contrast: number | null } | null;
  productCardRatios: number[];
  topNavItems: number | null;
  notes: string[];
}

export type RecGroup = 'critical' | 'high' | 'design' | 'conversion' | 'seo' | 'longterm';
export type Complexity = 'low' | 'medium' | 'high';

export interface BusinessRecommendation {
  id: string;
  group: RecGroup;
  priority: Severity;
  complexity: Complexity;
  basis: Basis;
  params: Params;
}

export interface BusinessAnalysis {
  version: 1;
  identity: BusinessIdentity;
  platform: PlatformDetection;
  coverage: CrawlCoverage;
  catalog: CatalogAnalysis | null;
  banners: BannerAnalysis;
  search: SearchAnalysis;
  journey: JourneyAnalysis;
  design: DesignAnalysis;
  recommendations: BusinessRecommendation[];
  /** Parts of the business analysis that could not run, with a reason code. */
  limits: string[];
}
