'use client';

import type { ReactNode } from 'react';
import { useBiz } from '@/lib/i18n/useBiz';
import { useI18n } from '@/lib/i18n';
import type { Confidence } from '@/types/business';

const CONF_COLOR: Record<Confidence, string> = { high: '#3ddc97', medium: '#f2c14e', low: '#ff8f4a' };

export function ConfidenceBadge({ value }: { value: Confidence | null | undefined }) {
  const b = useBiz();
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium" style={{ color: CONF_COLOR[value], borderColor: `${CONF_COLOR[value]}55` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: CONF_COLOR[value] }} />
      {b.confidence[value]}
    </span>
  );
}

export function BasisBadge({ basis }: { basis: 'verified' | 'inferred' }) {
  const { t } = useI18n();
  return (
    <span className={`rounded-full border px-2 py-px text-[11px] ${basis === 'verified' ? 'border-good/25 text-good/90' : 'border-line-strong text-muted'}`} title={basis === 'verified' ? t.basis.verifiedHint : t.basis.inferredHint}>
      {t.basis[basis]}
    </span>
  );
}

export function Stat({ label, value, sub, testId }: { label: string; value: ReactNode; sub?: ReactNode; testId?: string }) {
  return (
    <div className="panel flex flex-col justify-between gap-3 p-5" data-testid={testId}>
      <p className="text-xs text-muted">{label}</p>
      <div className="heading text-2xl text-ink md:text-[28px]">{value}</div>
      {sub ? <p className="text-[11px] leading-relaxed text-faint">{sub}</p> : null}
    </div>
  );
}

export function YesNo({ value, unknownLabel }: { value: boolean | null | undefined; unknownLabel?: string }) {
  const b = useBiz();
  if (value === null || value === undefined) return <span className="text-sm text-faint">{unknownLabel ?? b.notTested}</span>;
  return value ? (
    <span className="inline-flex items-center gap-1.5 text-sm text-good">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
      {b.yes}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-sm text-bad">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
      {b.no}
    </span>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-line py-3 last:border-b-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm text-ink">{children}</span>
    </div>
  );
}

export function Evidence({ items }: { items: string[] }) {
  const b = useBiz();
  if (!items.length) return null;
  return (
    <div className="mt-3">
      <p className="text-[11px] font-medium text-faint">{b.evidence}</p>
      <ul className="mt-1.5 space-y-1">
        {items.map((e) => (
          <li key={e} className="rounded-md border border-line bg-black/30 px-2.5 py-1 font-mono text-[12px] text-ink/80 [overflow-wrap:anywhere]" dir="auto">
            {e}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Swatches({ colors }: { colors: string[] }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5" dir="ltr">
      {colors.map((c) => (
        <span key={c} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/[0.03] py-0.5 pe-2.5 ps-0.5 font-mono text-[11px] text-muted">
          <span className="h-4 w-4 rounded-full border border-white/20" style={{ background: c }} />
          {c}
        </span>
      ))}
    </span>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-line bg-white/[0.02] px-4 py-3 text-sm leading-relaxed text-muted">{children}</p>;
}

export const shortPath = (url: string) => {
  try {
    const u = new URL(url);
    const p = decodeURIComponent(u.pathname) + (u.search ? u.search : '');
    return p.length > 60 ? `${p.slice(0, 59)}…` : p || '/';
  } catch {
    return url;
  }
};

export const kb = (bytes: number | null) => (bytes === null ? '—' : bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);
