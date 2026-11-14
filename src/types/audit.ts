import type { BusinessAnalysis } from './business';

export type Locale = 'ar' | 'en';
export type CategoryId = 'performance' | 'mobile' | 'seo' | 'security' | 'accessibility' | 'ux';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
/** verified = measured directly; inferred = heuristic reading of the page's HTML. */
export type Basis = 'verified' | 'inferred';
export type MetricId = 'fcp' | 'lcp' | 'si' | 'tbt' | 'cls';
export type Strategy = 'mobile' | 'desktop';
export type Grade = 'excellent' | 'good' | 'needs_improvement' | 'weak' | 'critical';
export type Params = Record<string, string | number | boolean | null>;

export type NotTestedReason =
  | 'psi_unavailable'
  | 'site_unreachable'
  | 'client_rendered'
  | 'not_applicable'
  | 'not_reported';

export type PsiErrorCode =
  | 'quota'
  | 'invalid_key'
  | 'lighthouse_failed'
  | 'timeout'
  | 'network'
  | 'unknown';

export type SiteErrorCode =
  | 'timeout'
  | 'dns_failed'
  | 'connection_failed'
  | 'tls_error'
  | 'too_many_redirects'
  | 'http_error'
  | 'not_html';

export interface AuditRef {
  id: string;
  /** Title as reported by Lighthouse (English). Used as evidence only. */
  title: string;
  score: number | null;
  displayValue?: string;
  items?: number;
}

export interface FieldMetric {
  p75: number;
  category: string;
}

export interface FieldData {
  /** true when Google only had origin-level (whole-site) data. */
  origin: boolean;
  overall: string | null;
  lcp?: FieldMetric;
  inp?: FieldMetric;
  cls?: FieldMetric;
}

export interface StrategyData {
  strategy: Strategy;
  lighthouseVersion: string | null;
  /** Lighthouse category scores, 0–100. null = Lighthouse did not report it. */
  scores: {
    performance: number | null;
    accessibility: number | null;
    seo: number | null;
    bestPractices: number | null;
  };
  /** Lab metrics. Times in ms, CLS unitless. */
  metrics: Record<MetricId, { value: number | null; score: number | null }>;
  /** Curated subset of Lighthouse audits the rules engine reads. */
  audits: Record<string, AuditRef>;
  a11yFailures: AuditRef[];
  seoFailures: AuditRef[];
  field: FieldData | null;
}

export type PsiOutcome =
  | { ok: true; data: StrategyData }
  | { ok: false; error: PsiErrorCode; detail?: string };

export interface OnPageData {
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  robotsMeta: string | null;
  lang: string | null;
  viewport: string | null;
  h1Count: number;
  headingCount: number;
  headingOrderOk: boolean;
  wordCount: number;
  imageCount: number;
  imagesMissingAlt: number;
  navLinkCount: number;
  hasNavLandmark: boolean;
  headerLinkCount: number;
  contact: { tel: boolean; email: boolean; whatsapp: boolean; contactLink: boolean; form: boolean };
  ctaCount: number;
  ctaSamples: string[];
  mixedContentCount: number;
  mixedContentSamples: string[];
  scriptCount: number;
  likelyClientRendered: boolean;
}

export interface SiteProbe {
  ok: boolean;
  error?: SiteErrorCode;
  errorDetail?: string;
  requestedUrl: string;
  finalUrl: string;
  status: number | null;
  redirectCount: number;
  https: boolean;
  /** Does http:// redirect to https://? null = could not be tested. */
  httpRedirectsToHttps: boolean | null;
  ttfbMs: number | null;
  /** Lower-cased response headers relevant to the audit. */
  headers: Record<string, string>;
  onPage: OnPageData | null;
}

export interface CheckResult {
  id: string;
  /** Share of the category score, 0–100. Shares within a category sum to 100. */
  weight: number;
  /** 0–100, or null when the check could not be completed. */
  score: number | null;
  basis: Basis;
  reason?: NotTestedReason;
  params: Params;
}

export interface CategoryResult {
  id: CategoryId;
  weight: number;
  score: number | null;
  status: 'complete' | 'partial' | 'unavailable';
  /** Share (0–1) of the category's checks that produced data. */
  coverage: number;
  checks: CheckResult[];
}

export interface Finding {
  id: string;
  category: CategoryId;
  severity: Severity;
  basis: Basis;
  params: Params;
}

export interface Strength {
  id: string;
  category: CategoryId;
  params: Params;
}

export interface AiSummary {
  en: string;
  ar: string;
  model: string;
}

export interface AuditReport {
  version: 1;
  id: string;
  requestedUrl: string;
  finalUrl: string;
  host: string;
  generatedAt: string;
  durationMs: number;
  overall: {
    score: number | null;
    grade: Grade | null;
    /** Sum of the weights (0–100) of categories that produced a score. */
    coveredWeight: number;
  };
  categories: CategoryResult[];
  psi: { mobile: PsiOutcome; desktop: PsiOutcome };
  site: SiteProbe;
  findings: Finding[];
  strengths: Strength[];
  ai: AiSummary | null;
  /** Business-level analysis (absent in reports made before it existed). */
  business?: BusinessAnalysis | null;
}

export type AuditTaskId =
  | 'connect'
  | 'onpage'
  | 'security'
  | 'psi_mobile'
  | 'psi_desktop'
  | 'identity'
  | 'crawl'
  | 'products'
  | 'search'
  | 'design'
  | 'scoring';

export type AuditErrorCode =
  | 'invalid_url'
  | 'blocked_url'
  | 'unreachable'
  | 'rate_limited'
  | 'server_error';

export type AuditEvent =
  | { t: 'task'; id: AuditTaskId; s: 'start' | 'done' | 'fail'; code?: string }
  | { t: 'result'; report: AuditReport }
  | { t: 'error'; code: AuditErrorCode; detail?: string };
