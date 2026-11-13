import type { Finding, Locale, Params, Strength } from '@/types/audit';
import { findingsAr, strengthsAr } from './content.ar';
import { findingsEn, strengthsEn } from './content.en';

export interface FindingCopy {
  title: string | ((p: Params) => string);
  /** What the technical finding means, in plain language. */
  explanation: string;
  /** The measured value behind the finding. */
  evidence: (p: Params) => string;
  /** Why a business owner should care. No revenue or ranking promises. */
  business: string;
  fix: string;
}

export type StrengthCopy = (p: Params) => string;

export interface ResolvedFinding {
  title: string;
  explanation: string;
  evidence: string;
  business: string;
  fix: string;
}

const FINDINGS: Record<Locale, Record<string, FindingCopy>> = { en: findingsEn, ar: findingsAr };
const STRENGTHS: Record<Locale, Record<string, StrengthCopy>> = { en: strengthsEn, ar: strengthsAr };

/** Turn a finding (id + measured params) into text in the requested language. */
export function resolveFinding(finding: Finding, locale: Locale): ResolvedFinding | null {
  const copy = FINDINGS[locale][finding.id];
  if (!copy) return null;
  return {
    title: typeof copy.title === 'function' ? copy.title(finding.params) : copy.title,
    explanation: copy.explanation,
    evidence: copy.evidence(finding.params),
    business: copy.business,
    fix: copy.fix,
  };
}

export function resolveStrength(strength: Strength, locale: Locale): string | null {
  const copy = STRENGTHS[locale][strength.id];
  return copy ? copy(strength.params) : null;
}

export const FINDING_IDS = Object.keys(findingsEn);
