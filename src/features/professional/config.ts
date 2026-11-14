import type { SiteCategory } from '@/types/business';
import type { PillarId, ProfileId, QualityLevel } from '@/types/professional';

/**
 * Professionalism scoring configuration. These are initial product values,
 * not an external standard; change them here and every report (web and PDF)
 * follows.
 */

/** Pillar weights per profile (each profile sums to 100). */
export const PROFILE_WEIGHTS: Record<ProfileId, Partial<Record<PillarId, number>>> = {
  ecommerce: {
    merchandising: 20,
    visual: 15,
    product_page: 15,
    navigation: 10,
    conversion: 15,
    mobile: 10,
    technical: 5,
    seo_trust: 10,
  },
  general: {
    visual: 10,
    structure: 10,
    content: 30,
    conversion: 15,
    mobile: 10,
    technical: 5,
    seo: 5,
    trust: 15,
  },
};

/** Which profile each website category is evaluated with. Industry-specific profiles come in a later phase. */
export const CATEGORY_PROFILE: Record<SiteCategory, ProfileId> = {
  ecommerce: 'ecommerce',
  corporate: 'general',
  law: 'general',
  tourism: 'general',
  restaurant: 'general',
  real_estate: 'general',
  medical: 'general',
  agency: 'general',
  technology: 'general',
  saas: 'general',
  portfolio: 'general',
  consulting: 'general',
  education: 'general',
  construction: 'general',
  professional_services: 'general',
  other: 'general',
};

/** Quality levels: minimum score for each, highest first. */
export const QUALITY_LEVELS: { level: QualityLevel; min: number }[] = [
  { level: 'excellent', min: 90 },
  { level: 'professional', min: 80 },
  { level: 'good', min: 70 },
  { level: 'needs_improvement', min: 50 },
  { level: 'significant_issues', min: 0 },
];

/** A pillar is scored only when criteria worth this share of it produced a score. */
export const MIN_PILLAR_COVERAGE = 0.4;
/** The overall score is shown only when pillars worth this many points were scored. */
export const MIN_OVERALL_WEIGHT = 60;

/**
 * "Excellent" is a claim about the whole website, including how it looks.
 * It is only awarded when a visual assessment ran and most criteria were
 * tested; otherwise the level stops at "Professional" and the report says why.
 */
export const EXCELLENT_REQUIRES = { visualAssessment: true, criteriaCoverage: 0.85 };

/** Confidence in the overall score, from the share of applicable criteria (by weight) that were tested. */
export const CONFIDENCE_BANDS = { high: 0.85, medium: 0.65 };

export const levelFor = (score: number): QualityLevel => QUALITY_LEVELS.find((l) => score >= l.min)!.level;
