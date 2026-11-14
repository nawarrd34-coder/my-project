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

export type PageKind =
  | 'home'
  | 'product'
  | 'category'
  | 'about'
  | 'contact'
  | 'search'
  | 'policy'
  | 'blog'
  | 'services'
  | 'pricing'
  | 'booking'
  | 'menu'
  | 'other';

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

// ─── Classification (Phase 1) ───────────────────────────────────────────────

/** The kind of website, which decides how it is evaluated. */
export type SiteCategory =
  | 'ecommerce'
  | 'corporate'
  | 'law'
  | 'tourism'
  | 'restaurant'
  | 'real_estate'
  | 'medical'
  | 'agency'
  | 'technology'
  | 'saas'
  | 'portfolio'
  | 'consulting'
  | 'education'
  | 'construction'
  | 'professional_services'
  | 'other';

/** How the business turns visitors into customers. */
export type BusinessModel =
  | 'direct_sales'
  | 'lead_generation'
  | 'online_booking'
  | 'appointments'
  | 'quotation'
  | 'subscription'
  | 'physical_visit'
  | 'direct_communication';

/** One piece of evidence, tied to the page and place it was observed. */
export interface Evidence {
  url: string;
  /** Where on the page: a section, element or source (e.g. "header links", "JSON-LD"). */
  where: string;
  /** What was observed (a value, quote or count). */
  value?: string;
  /** Which homepage screenshot shows it, when the observation comes from the rendered page. */
  screenshot?: 'desktop' | 'mobile';
}

export interface ModelSignal {
  model: BusinessModel;
  /** Relative strength of the signals found (not a probability). */
  strength: number;
  evidence: Evidence[];
}

export interface SiteClassification {
  category: { value: SiteCategory; confidence: Confidence; evidence: Evidence[]; alternatives: SiteCategory[] };
  /** True when the category should be confirmed by the user before relying on it. */
  uncertain: boolean;
  model: { primary: BusinessModel | null; secondary: BusinessModel[]; hybrid: boolean; confidence: Confidence | null; signals: ModelSignal[] };
  services: { name: string; source: string }[];
  /** Inferred from wording only; null when there were no signals. */
  audience: { value: 'businesses' | 'consumers' | 'both'; confidence: Confidence; evidence: Evidence[] } | null;
  /** The main thing a visitor is expected to do, and the button text seen for it. */
  conversion: { action: BusinessModel; label: string | null; evidence: Evidence[] } | null;
  /** Page-level signals used by classification and scoring. */
  signals: {
    ldTypes: string[];
    openGraph: boolean;
    mapEmbed: boolean;
    openingHours: boolean;
    address: boolean;
    forms: number;
    dateInputs: boolean;
    genericPhrases: string[];
    homepageProducts: number;
    /** Main homepage headline and whether a supporting sentence follows it (absent in older reports). */
    hero?: { headline: string | null; support: boolean };
    /** Kinds of proof found (numbers, clients, case studies, team), with what was seen. */
    proof?: { kind: 'numbers' | 'clients' | 'cases' | 'team'; value: string; url: string }[];
  };
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
  /** Website type and business model (absent in reports made before Phase 1). */
  classification?: SiteClassification;
  /** Parts of the business analysis that could not run, with a reason code. */
  limits: string[];
}
