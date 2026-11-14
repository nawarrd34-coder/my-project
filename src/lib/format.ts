import type { Grade, Locale, MetricId, Severity } from '@/types/audit';
import { gradeFor, THRESHOLDS } from '@/features/scoring/engine';

export const GRADE_COLOR: Record<Grade, string> = {
  excellent: '#3ddc97',
  good: '#5fb8ff',
  needs_improvement: '#f2c14e',
  weak: '#ff8f4a',
  critical: '#ff5468',
};

export const SEVERITY_COLOR: Record<Severity, string> = {
  critical: '#ff5468',
  high: '#ff8f4a',
  medium: '#f2c14e',
  low: '#5fb8ff',
  info: '#8d8d9c',
};

export const scoreColor = (score: number | null) => (score === null ? '#5a5a68' : GRADE_COLOR[gradeFor(score)]);

export type Band = 'good' | 'mid' | 'poor';

export function metricBand(id: MetricId, value: number): Band {
  const t = THRESHOLDS[id];
  return value <= t.good ? 'good' : value <= t.poor ? 'mid' : 'poor';
}

export const BAND_COLOR: Record<Band, string> = { good: '#3ddc97', mid: '#f2c14e', poor: '#ff5468' };

/** Metric values keep Western digits and unit symbols in both languages. */
export function formatMetric(id: MetricId | 'inp', value: number | null): string {
  if (value === null) return '—';
  if (id === 'cls') return value.toFixed(2);
  if (id === 'tbt' || id === 'inp') return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

export function metricGoodLimit(id: MetricId): string {
  return formatMetric(id, THRESHOLDS[id].good);
}

export function formatDate(iso: string, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
