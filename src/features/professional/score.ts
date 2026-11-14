import type { AuditReport, Severity } from '@/types/audit';
import type { SiteCategory } from '@/types/business';
import type { CriterionResult, EvidenceBasis, PillarId, PillarResult, ProfessionalScore, QualityLevel } from '@/types/professional';
import { CATEGORY_PROFILE, CONFIDENCE_BANDS, EXCELLENT_REQUIRES, levelFor, MIN_OVERALL_WEIGHT, MIN_PILLAR_COVERAGE, PROFILE_WEIGHTS } from './config';
import { CRITERIA, type Ctx } from './criteria';

/**
 * PROFESSIONALISM SCORING
 *
 * 1. The website's category (detected, or chosen by the user) picks a profile:
 *    e-commerce or general. Each profile has pillars with weights (config.ts).
 * 2. Each pillar is made of criteria with a share of the pillar. A criterion
 *    scores 0–100 from evidence, or is "untested" / "n/a" and left out.
 * 3. Pillar score = weighted average of its scored criteria; it needs
 *    MIN_PILLAR_COVERAGE of its shares to be shown.
 * 4. Overall = weighted average of scored pillars, re-normalised; it needs
 *    pillars worth MIN_OVERALL_WEIGHT points. Technical performance is only
 *    5 points, so a fast site is not called professional for loading quickly.
 *
 * Pure function of the report: the browser and the PDF compute the same result.
 */
export function scoreProfessional(report: AuditReport, categoryOverride?: SiteCategory | null): ProfessionalScore | null {
  const b = report.business;
  if (!b) return null;
  const cl = b.classification;
  const category: SiteCategory = categoryOverride ?? cl?.category.value ?? (b.identity.websiteType.value === 'ecommerce' ? 'ecommerce' : 'other');
  const profile = CATEGORY_PROFILE[category];
  const weights = PROFILE_WEIGHTS[profile];
  const ctx: Ctx = {
    report,
    b,
    cl,
    home: report.finalUrl,
    rendered: b.design.rendered,
    saudi: b.identity.country?.code === 'SA',
    profile,
  };

  const criteria: CriterionResult[] = [];
  for (const def of CRITERIA) {
    const slot = def.in[profile];
    if (!slot) continue;
    let out;
    try {
      out = def.run(ctx);
    } catch {
      out = { status: 'untested' as const, score: null, basis: 'unverified' as const, confidence: null, evidence: [], params: {}, reason: 'error' };
    }
    criteria.push({ id: def.id, pillar: slot.pillar, weight: slot.weight, importance: def.importance, related: def.related, ...out, severity: severityFor(out.score, def.importance) });
  }

  const pillars: PillarResult[] = (Object.entries(weights) as [PillarId, number][]).map(([id, weight]) => {
    const own = criteria.filter((c) => c.pillar === id && c.status !== 'na');
    const total = own.reduce((n, c) => n + c.weight, 0);
    const done = own.filter((c) => c.status === 'scored');
    const doneWeight = done.reduce((n, c) => n + c.weight, 0);
    const coverage = total ? doneWeight / total : 0;
    if (!done.length || coverage < MIN_PILLAR_COVERAGE) return { id, weight, score: null, coverage, status: 'unavailable' };
    const score = Math.round(done.reduce((n, c) => n + (c.score ?? 0) * c.weight, 0) / doneWeight);
    return { id, weight, score, coverage, status: coverage >= 0.999 ? 'scored' : 'partial' };
  });

  const scoredPillars = pillars.filter((p) => p.score !== null);
  const coveredWeight = scoredPillars.reduce((n, p) => n + p.weight, 0);
  const overallScore = coveredWeight >= MIN_OVERALL_WEIGHT ? Math.round(scoredPillars.reduce((n, p) => n + p.score! * p.weight, 0) / coveredWeight) : null;

  // Share of all applicable criteria (weighted by pillar and by share in the pillar) that were tested.
  const criteriaCoverage =
    Math.round(
      (pillars.reduce((n, p) => {
        const own = criteria.filter((c) => c.pillar === p.id && c.status !== 'na');
        const total = own.reduce((m, c) => m + c.weight, 0);
        return n + (total ? p.weight * p.coverage : 0);
      }, 0) /
        Math.max(1, pillars.reduce((n, p) => n + (criteria.some((c) => c.pillar === p.id && c.status !== 'na') ? p.weight : 0), 0))) *
        100,
    ) / 100;
  const confidence = criteriaCoverage >= CONFIDENCE_BANDS.high ? 'high' : criteriaCoverage >= CONFIDENCE_BANDS.medium ? 'medium' : 'low';
  // No criterion uses a screenshot-based model assessment yet (planned for Phase 2).
  const visualAssessment = criteria.some((c) => c.basis === 'ai' && c.pillar === 'visual' && c.status === 'scored');

  let level: QualityLevel | null = overallScore === null ? null : levelFor(overallScore);
  let levelCap: ProfessionalScore['overall']['levelCap'] = null;
  if (level === 'excellent') {
    if (EXCELLENT_REQUIRES.visualAssessment && !visualAssessment) levelCap = 'needs_visual_assessment';
    else if (criteriaCoverage < EXCELLENT_REQUIRES.criteriaCoverage) levelCap = 'low_coverage';
    if (levelCap) level = 'professional';
  }

  const basisCounts = { measured: 0, detected: 0, ai: 0, unverified: 0, na: 0 } as Record<EvidenceBasis, number>;
  for (const c of criteria) basisCounts[c.basis] += 1;

  return {
    version: 1,
    profile,
    category,
    categorySource: categoryOverride ? 'user' : 'detected',
    overall: { score: overallScore, level, coveredWeight, criteriaCoverage, confidence, levelCap },
    visualAssessment,
    basisCounts,
    pillars,
    criteria,
  };
}

/** Low scores become findings; how severe depends on how much the criterion matters. */
function severityFor(score: number | null, importance: CriterionResult['importance']): Severity | null {
  if (score === null || score >= 70) return null;
  if (score < 20 && importance === 'high') return 'critical';
  if (score < 40) return importance === 'high' ? 'high' : importance === 'medium' ? 'medium' : 'low';
  return importance === 'high' ? 'medium' : 'low';
}
