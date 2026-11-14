import type { Params, Severity } from './audit';
import type { Confidence, Evidence, SiteCategory } from './business';

/**
 * Professionalism score (Phase 1). Separate from the technical Digital Health
 * Score: it rates how professionally the website is built for its type of
 * business, from criteria with defined rules and recorded evidence.
 */
export type ProfileId = 'ecommerce' | 'general';

export type PillarId =
  // e-commerce
  | 'merchandising'
  | 'visual'
  | 'product_page'
  | 'navigation'
  | 'conversion'
  | 'mobile'
  | 'technical'
  | 'seo_trust'
  // general websites
  | 'structure'
  | 'content'
  | 'seo'
  | 'trust';

/**
 * measured: from the rendered page or Lighthouse; detected: found in the page
 * HTML or crawl; ai: a model's visual judgement (not used yet); unverified:
 * the check could not confirm presence or absence; na: does not apply.
 */
export type EvidenceBasis = 'measured' | 'detected' | 'ai' | 'unverified' | 'na';

export type QualityLevel = 'excellent' | 'professional' | 'good' | 'needs_improvement' | 'significant_issues';

export interface CriterionResult {
  id: string;
  pillar: PillarId;
  /** Share of the pillar (shares inside a pillar sum to 100). */
  weight: number;
  importance: 'high' | 'medium' | 'low';
  status: 'scored' | 'untested' | 'na';
  score: number | null;
  basis: EvidenceBasis;
  confidence: Confidence | null;
  evidence: Evidence[];
  /** Values for the observation text. */
  params: Params;
  /** Why an untested or n/a criterion has no score. */
  reason?: string;
  /** Set when the score is low enough to be a finding. */
  severity: Severity | null;
  /** Existing recommendation or finding ids that already cover this problem. */
  related: string[];
}

export interface PillarResult {
  id: PillarId;
  weight: number;
  score: number | null;
  /** Share (0–1) of the pillar's criteria weight that produced a score. */
  coverage: number;
  status: 'scored' | 'partial' | 'unavailable';
}

export interface ProfessionalScore {
  version: 1;
  profile: ProfileId;
  category: SiteCategory;
  categorySource: 'detected' | 'user';
  overall: {
    score: number | null;
    level: QualityLevel | null;
    /** Points (of 100) of pillars that produced a score. */
    coveredWeight: number;
    /** Share (0–1) of all applicable criteria, by weight, that were actually tested. */
    criteriaCoverage: number;
    /** How much to rely on the overall score, from criteriaCoverage. */
    confidence: Confidence;
    /** Why the level is lower than the score alone would give, if it is. */
    levelCap: 'needs_visual_assessment' | 'low_coverage' | null;
  };
  /** Whether a screenshot-based visual assessment was part of this score. */
  visualAssessment: boolean;
  /** Number of criteria per evidence basis. */
  basisCounts: Record<EvidenceBasis, number>;
  pillars: PillarResult[];
  criteria: CriterionResult[];
}
