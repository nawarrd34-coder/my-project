import type { ResolvedRec } from '@/features/business/content';
import type { Finding, Locale } from '@/types/audit';
import type { BusinessRecommendation, RecGroup } from '@/types/business';
import type { CriterionResult, PillarId, ProfessionalScore } from '@/types/professional';
import { criterionCopy, proDicts } from './copy';

const GROUP: Record<PillarId, RecGroup> = {
  merchandising: 'conversion',
  visual: 'design',
  product_page: 'conversion',
  navigation: 'conversion',
  conversion: 'conversion',
  mobile: 'design',
  technical: 'longterm',
  seo_trust: 'seo',
  structure: 'design',
  content: 'seo',
  seo: 'seo',
  trust: 'conversion',
};

/** Ids of rules and findings in this report, to tell which criteria are already covered. */
export function coveredIds(business: BusinessRecommendation[], findings: Finding[]): Set<string> {
  return new Set([...business.map((r) => r.id), ...findings.filter((f) => f.severity !== 'info').map((f) => f.id)]);
}

export const isCovered = (c: CriterionResult, covered: Set<string>) => c.related.some((id) => covered.has(id));

/**
 * Low-scoring criteria that no existing rule or finding covers become
 * recommendations, so the action list has each problem once.
 */
export function professionalRecs(pro: ProfessionalScore | null, covered: Set<string>, locale: Locale): ResolvedRec[] {
  if (!pro) return [];
  const d = proDicts[locale];
  return pro.criteria
    .filter((c) => c.severity && c.severity !== 'info' && !isCovered(c, covered))
    .map((c) => {
      const copy = criterionCopy(locale, c.id)!;
      const group: RecGroup = c.severity === 'critical' ? 'critical' : c.severity === 'high' ? 'high' : GROUP[c.pillar];
      return {
        key: `p-${c.id}`,
        group,
        priority: c.severity!,
        complexity: c.importance === 'high' ? 'medium' : 'low',
        basis: c.basis === 'measured' ? 'verified' : 'inferred',
        title: copy.name,
        where: d.pillars[c.pillar].name,
        evidence: copy.observed(c.params, c.score),
        why: copy.why,
        fix: copy.fix,
        source: 'professional' as const,
      };
    });
}
