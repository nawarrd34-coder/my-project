'use client';

import { useState } from 'react';
import { Chevron } from '@/components/ui/icons';
import { scoreColor } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { AuditReport } from '@/types/audit';
import { Section } from './Section';

export function Methodology({ report, lighthouseVersion }: { report: AuditReport; lighthouseVersion: string | null }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const gaps = report.categories.flatMap((c) => c.checks.filter((k) => k.score === null).map((k) => ({ category: c.id, check: k })));

  return (
    <>
      {gaps.length > 0 && (
        <Section title={t.results.gapsTitle} subtitle={t.results.gapsSubtitle}>
          <ul className="panel divide-y divide-line" data-testid="gaps">
            {gaps.map(({ category, check }) => (
              <li key={check.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-3.5 text-sm">
                <span className="text-ink/90">
                  {t.checks[check.id as keyof typeof t.checks] ?? check.id}
                  <span className="ms-2 text-xs text-faint">{t.categories[category].name}</span>
                </span>
                <span className="text-xs text-warn">{t.reasons[check.reason ?? 'not_reported']}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={t.results.methodTitle}>
        <div className="panel overflow-hidden">
          <div className="p-6 md:p-8">
            <p className="max-w-3xl text-sm leading-relaxed text-muted">{t.results.methodIntro}</p>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">{t.results.methodBands}</p>
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="btn-ghost mt-5 h-9 text-[13px]" data-testid="method-toggle">
              {t.results.methodTitle}
              <Chevron open={open} />
            </button>
          </div>
          {open && (
            <div className="border-t border-line" data-testid="method-table">
              {report.categories.map((c) => (
                <div key={c.id} className="border-b border-line last:border-b-0">
                  <div className="flex items-center justify-between gap-4 bg-white/[0.02] px-6 py-3">
                    <span className="text-sm font-medium text-ink">
                      {t.categories[c.id].name} <span className="ms-2 text-xs font-normal text-faint">{t.results.weight(c.weight)}</span>
                    </span>
                    <span className="num text-sm" style={{ color: scoreColor(c.score) }}>
                      {c.score === null ? t.results.notTested : `${c.score}/100`}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead>
                        <tr className="text-xs text-faint">
                          <th className="px-6 py-2 text-start font-normal" />
                          <th className="px-3 py-2 text-end font-normal">{t.results.methodShare}</th>
                          <th className="px-3 py-2 text-end font-normal">{t.results.methodResult}</th>
                          <th className="px-6 py-2 text-end font-normal">{t.results.methodBasis}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.checks.map((k) => (
                          <tr key={k.id} className="border-t border-line/60">
                            <td className="px-6 py-2.5 text-ink/90">{t.checks[k.id as keyof typeof t.checks] ?? k.id}</td>
                            <td className="num px-3 py-2.5 text-end text-muted">{k.weight}%</td>
                            <td className="px-3 py-2.5 text-end">
                              {k.score === null ? (
                                <span className="text-xs text-warn">{t.reasons[k.reason ?? 'not_reported']}</span>
                              ) : (
                                <span className="num" style={{ color: scoreColor(k.score) }}>{k.score}</span>
                              )}
                            </td>
                            <td className="px-6 py-2.5 text-end text-xs text-faint">{t.basis[k.basis]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <h3 className="text-sm font-medium text-ink">{t.results.limitsTitle}</h3>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
              {t.results.limits.map((l) => (
                <li key={l} className="flex gap-3">
                  <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-faint" />
                  {l}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-faint">{t.results.dataSources(lighthouseVersion)}</p>
          </div>
        </div>
      </Section>
    </>
  );
}
