import { resolveFinding } from '@/features/recommendations/content';
import type { Basis, Finding, Locale, Severity } from '@/types/audit';
import type { BusinessRecommendation, Complexity, RecGroup } from '@/types/business';
import { recsAr } from './content.ar';
import { recsEn, type RecCopy } from './content.en';
import { complexityForFinding, groupForFinding } from './recommendations';

const COPY: Record<Locale, Record<string, RecCopy>> = { en: recsEn, ar: recsAr };

export interface ResolvedRec {
  key: string;
  group: RecGroup;
  priority: Severity;
  complexity: Complexity;
  basis: Basis;
  title: string;
  where: string;
  evidence: string;
  why: string;
  fix: string;
  source: 'business' | 'technical';
}

const val = (v: RecCopy['title'], p: BusinessRecommendation['params']) => (typeof v === 'function' ? v(p) : v);

/**
 * One list of recommendations for the report: business rules plus the
 * technical findings, mapped into the six recommendation groups.
 */
export function resolveRecommendations(
  business: BusinessRecommendation[],
  findings: Finding[],
  locale: Locale,
  whereForCategory: (c: Finding['category']) => string,
): ResolvedRec[] {
  const out: ResolvedRec[] = [];
  business.forEach((r, i) => {
    const c = COPY[locale][r.id];
    if (!c) return;
    out.push({
      key: `b-${r.id}-${i}`,
      group: r.group,
      priority: r.priority,
      complexity: r.complexity,
      basis: r.basis,
      title: val(c.title, r.params),
      where: val(c.where, r.params),
      evidence: c.evidence(r.params),
      why: c.why,
      fix: c.fix,
      source: 'business',
    });
  });
  findings.forEach((f, i) => {
    if (f.severity === 'info') return;
    const c = resolveFinding(f, locale);
    if (!c) return;
    out.push({
      key: `t-${f.id}-${i}`,
      group: groupForFinding(f),
      priority: f.severity,
      complexity: complexityForFinding(f),
      basis: f.basis,
      title: c.title,
      where: whereForCategory(f.category),
      evidence: c.evidence,
      why: c.business,
      fix: c.fix,
      source: 'technical',
    });
  });
  const rank: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  return out.sort((a, b) => rank[a.priority] - rank[b.priority]);
}

export const REC_GROUPS: RecGroup[] = ['critical', 'high', 'design', 'conversion', 'seo', 'longterm'];
export const BUSINESS_REC_IDS = Object.keys(recsEn);
