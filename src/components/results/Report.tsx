'use client';

import { motion } from 'motion/react';
import { useMemo, useState, type ReactNode } from 'react';
import { CategoryIcon } from '@/components/ui/icons';
import { GlassOrb } from '@/components/brand/GlassOrb';
import { CountUp } from '@/components/ui/CountUp';
import { MiniRing } from '@/components/ui/ScoreGauge';
import { resolveFinding, resolveStrength } from '@/features/recommendations/content';
import { BAND_COLOR, formatDate, formatMetric, GRADE_COLOR, metricBand, metricGoodLimit, scoreColor } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { AuditReport, CategoryResult, MetricId, StrategyData } from '@/types/audit';
import { ActionPlan } from './ActionPlan';
import { IssueList } from './IssueList';
import { Methodology } from './Methodology';
import { Section } from './Section';
import { StudioCta } from './StudioCta';

const METRICS: MetricId[] = ['fcp', 'lcp', 'si', 'tbt', 'cls'];

function Notice({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warn/25 bg-warn/[0.06] px-4 py-3 text-sm text-ink/90" role="status">
      <span className="flex items-start gap-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f2c14e" strokeWidth="2" strokeLinecap="round" className="mt-0.5 shrink-0" aria-hidden="true">
          <path d="M12 8v5M12 16.5v.5" />
          <circle cx="12" cy="12" r="9" />
        </svg>
        <span>{children}</span>
      </span>
      {action}
    </div>
  );
}

function CategoryRow({ c, index }: { c: CategoryResult; index: number }) {
  const { t } = useI18n();
  return (
    <li className="py-4" data-category={c.id} data-score={c.score ?? 'na'}>
      <div className="flex items-center gap-3">
        <span className="text-silver">
          <CategoryIcon id={c.id} size={18} />
        </span>
        <span className="flex-1 text-[15px] text-ink">
          {t.categories[c.id].name}
          {c.status === 'partial' && <span className="ms-2 rounded-full border border-line px-2 py-0.5 text-[11px] text-faint">{t.results.partial}</span>}
        </span>
        <span className="text-xs text-faint">{t.results.weight(c.weight)}</span>
        {c.score === null ? (
          <span className="w-20 text-end text-sm text-faint">{t.results.notTested}</span>
        ) : (
          <span className="num w-20 text-end text-lg font-medium" style={{ color: scoreColor(c.score) }}>
            {c.score}
          </span>
        )}
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.07]">
        {c.score !== null && (
          <motion.div
            className="h-full rounded-full"
            style={{ background: scoreColor(c.score) }}
            initial={{ width: 0 }}
            animate={{ width: `${c.score}%` }}
            transition={{ duration: 1, delay: 0.3 + index * 0.08, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
      </div>
    </li>
  );
}

function StrategyCard({ label, data, error }: { label: string; data: StrategyData | null; error?: string }) {
  const { t } = useI18n();
  const cats = ['performance', 'accessibility', 'seo', 'bestPractices'] as const;
  return (
    <div className="panel p-6" data-strategy={data?.strategy ?? 'missing'}>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium text-ink">{label}</h3>
        {!data && <span className="text-xs text-warn">{error ?? t.results.notTested}</span>}
      </div>
      <div className="mt-5 grid grid-cols-4 gap-2">
        {cats.map((k) => (
          <div key={k} className="flex flex-col items-center gap-2 text-center">
            <MiniRing score={data ? data.scores[k] : null} />
            <span className="text-[11px] leading-tight text-faint">{t.results.lhCategories[k]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Report({ report, onRescan, onNew }: { report: AuditReport; onRescan: () => void; onNew: () => void }) {
  const { t, locale } = useI18n();
  const [pdfState, setPdfState] = useState<'idle' | 'busy' | 'failed'>('idle');

  const mobile = report.psi.mobile.ok ? report.psi.mobile.data : null;
  const desktop = report.psi.desktop.ok ? report.psi.desktop.data : null;
  const { overall } = report;
  const critical = report.findings.filter((f) => f.severity === 'critical').length;
  const high = report.findings.filter((f) => f.severity === 'high').length;
  const strengths = useMemo(
    () => report.strengths.map((s) => resolveStrength(s, locale)).filter((s): s is string => !!s),
    [report.strengths, locale],
  );
  const lhVersion = mobile?.lighthouseVersion ?? desktop?.lighthouseVersion ?? null;
  const psiError = (o: AuditReport['psi']['mobile']) => (o.ok ? undefined : t.psiErrors[o.error]);
  const siteProblem = !report.site.ok && report.site.error
    ? report.site.error === 'http_error'
      ? t.siteErrors.http_error(report.site.errorDetail ?? '')
      : t.siteErrors[report.site.error]
    : null;
  const lab = mobile ?? desktop;

  const downloadPdf = async () => {
    setPdfState('busy');
    try {
      const res = await fetch('/api/report/pdf', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ report, locale }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `business-health-check-${report.host}-${locale}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
      setPdfState('idle');
    } catch {
      setPdfState('failed');
    }
  };

  return (
    <article className="relative container-page pb-8 pt-28 md:pt-36" data-testid="report">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <p className="eyebrow">{t.results.title}</p>
          <h1 className="display-black num mt-4 break-all text-[40px] text-ink md:text-[72px]">{report.host}</h1>
          <p className="mt-3 text-sm text-faint">
            {t.results.scannedOn}: <span className="text-muted">{formatDate(report.generatedAt, locale)}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={downloadPdf} disabled={pdfState === 'busy'} className="btn-solid h-12 px-6" data-testid="download-pdf">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" />
            </svg>
            {pdfState === 'busy' ? t.results.downloading : t.results.download}
          </button>
          <button type="button" onClick={onNew} className="btn-ghost h-12 px-6">
            {t.results.newScan}
          </button>
        </div>
      </header>
      {pdfState === 'failed' && (
        <p className="mt-3 text-sm text-crit" role="alert">
          {t.results.pdfFailed}
        </p>
      )}

      {/* Data gaps are stated up front, before any number. */}
      <div className="mt-8 space-y-3" data-testid="notices">
        {!mobile && !desktop && (
          <Notice action={<button type="button" onClick={onRescan} className="btn-ghost h-8 text-xs">{t.results.retryScan}</button>}>
            {t.results.psiFailed.both} <span className="text-faint">({psiError(report.psi.mobile)})</span>
          </Notice>
        )}
        {!mobile && desktop && <Notice>{t.results.psiFailed.mobile} <span className="text-faint">({psiError(report.psi.mobile)})</span></Notice>}
        {mobile && !desktop && <Notice>{t.results.psiFailed.desktop} <span className="text-faint">({psiError(report.psi.desktop)})</span></Notice>}
        {siteProblem && report.site.error !== 'tls_error' && (
          <Notice>
            {t.results.siteFailed} <span className="text-faint">({siteProblem})</span>
          </Notice>
        )}
        {report.site.onPage?.likelyClientRendered && <Notice>{t.results.clientRendered}</Notice>}
      </div>

      {/* Overview */}
      <div className="panel relative mt-6 overflow-hidden p-6 md:p-10">
        <div className="pointer-events-none absolute -top-44 start-0 h-80 w-80 rounded-full blur-[110px]" style={{ background: `${scoreColor(overall.score)}22` }} aria-hidden="true" />
        <div className="relative grid gap-10 lg:grid-cols-[320px_1fr] lg:gap-16">
          <div className="flex flex-col items-center text-center">
            <p className="text-sm text-muted">{t.results.overall}</p>
            <div className="relative mt-2 flex h-[260px] w-[260px] items-center justify-center">
              <GlassOrb size={260} energy={0.35} tint={overall.score === null ? '#2f6bff' : scoreColor(overall.score)} tintAmount={overall.score === null ? 0 : 0.8} className="absolute inset-0" />
            </div>
            <p className="num-display -mt-6 text-[92px] leading-none text-ink md:text-[112px]" data-testid="overall-score" aria-label={overall.score === null ? t.results.noOverall : `${overall.score}/100`}>
              {overall.score === null ? <span className="text-faint">—</span> : <CountUp to={overall.score} />}
              {overall.score !== null && <span className="ms-1 text-[0.28em] font-bold text-faint">/100</span>}
            </p>
            {overall.grade ? (
              <span className="mt-4 rounded-full px-4 py-1.5 text-sm font-semibold" style={{ color: GRADE_COLOR[overall.grade], background: `${GRADE_COLOR[overall.grade]}18` }} data-testid="grade">
                {t.grades[overall.grade]}
              </span>
            ) : (
              <span className="mt-1 text-sm font-medium text-warn">{t.results.noOverall}</span>
            )}
            <p className="mt-4 max-w-[260px] text-xs leading-relaxed text-faint">
              {overall.score === null ? t.results.noOverallBody(overall.coveredWeight) : overall.coveredWeight < 100 ? t.results.partialNote(overall.coveredWeight) : null}
            </p>
          </div>

          <div className="min-w-0">
            <h2 className="text-sm font-medium text-muted">{t.results.summaryTitle}</h2>
            <p className="heading mt-2 text-2xl text-ink md:text-[28px]">{t.results.counts(critical, high, report.findings.length)}</p>
            {report.ai && (
              <div className="mt-4 rounded-xl border border-accent/25 bg-accent/[0.06] p-4">
                <p className="text-[15px] leading-relaxed text-ink/90">{report.ai[locale]}</p>
                <p className="mt-2 text-xs text-faint">{t.results.aiLabel}</p>
              </div>
            )}
            <h2 className="mt-8 text-sm font-medium text-muted">{t.results.categoriesTitle}</h2>
            <ul className="mt-1 divide-y divide-line">
              {report.categories.map((c, i) => (
                <CategoryRow key={c.id} c={c} index={i} />
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Mobile vs desktop */}
      {(mobile || desktop) && (
        <Section title={t.results.compareTitle} subtitle={t.results.compareSubtitle}>
          <div className="grid gap-4 md:grid-cols-2">
            <StrategyCard label={t.results.mobile} data={mobile} error={psiError(report.psi.mobile)} />
            <StrategyCard label={t.results.desktop} data={desktop} error={psiError(report.psi.desktop)} />
          </div>
          <div className="panel mt-4 overflow-hidden">
            <div className="flex items-baseline justify-between gap-4 px-6 pt-5">
              <h3 className="text-base font-medium text-ink">{t.results.metricsTitle}</h3>
              <p className="text-xs text-faint">{t.results.metricsNote}</p>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[460px] text-sm">
                <thead>
                  <tr className="text-xs text-faint">
                    <th className="px-6 py-2 text-start font-normal" />
                    <th className="px-4 py-2 text-end font-normal">{t.results.mobile}</th>
                    <th className="px-6 py-2 text-end font-normal">{t.results.desktop}</th>
                  </tr>
                </thead>
                <tbody>
                  {METRICS.map((id) => (
                    <tr key={id} className="border-t border-line">
                      <td className="px-6 py-3.5">
                        <span className="text-ink" dir="ltr">{t.metrics[id].name}</span>
                        <span className="block text-xs text-faint">{t.metrics[id].desc}</span>
                      </td>
                      {[mobile, desktop].map((d, i) => {
                        const v = d?.metrics[id].value ?? null;
                        return (
                          <td key={i} className={`${i === 0 ? 'px-4' : 'px-6'} py-3.5 text-end`}>
                            <span className="num inline-flex items-center gap-2 whitespace-nowrap text-ink">
                              {v !== null && <span className="h-1.5 w-1.5 rounded-full" style={{ background: BAND_COLOR[metricBand(id, v)] }} />}
                              {v === null ? <span className="text-faint">—</span> : formatMetric(id, v)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>
      )}

      {/* Core Web Vitals */}
      {lab && (
        <Section title={t.results.vitalsTitle} subtitle={t.results.vitalsTbtNote}>
          <p className="mb-3 text-xs text-faint">{mobile ? t.results.vitalsLab : `${t.results.metricsNote} (${t.results.desktop})`}</p>
          <div className="grid gap-4 md:grid-cols-3">
            {(['lcp', 'cls', 'tbt'] as MetricId[]).map((id) => {
              const v = lab.metrics[id].value;
              const band = v === null ? null : metricBand(id, v);
              return (
                <div key={id} className="panel p-6" data-vital={id}>
                  <p className="text-sm text-muted" dir="ltr">{t.metrics[id].name}</p>
                  <p className="num mt-3 text-4xl font-semibold tracking-tight" style={{ color: band ? BAND_COLOR[band] : '#747482' }}>
                    {formatMetric(id, v)}
                  </p>
                  <div className="mt-4 flex h-1 gap-1" aria-hidden="true">
                    {(['good', 'mid', 'poor'] as const).map((b) => (
                      <span key={b} className="flex-1 rounded-full" style={{ background: band === b ? BAND_COLOR[b] : 'rgba(255,255,255,0.08)' }} />
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-faint">
                    {band ? <span style={{ color: BAND_COLOR[band] }}>{band === 'good' ? t.results.good : band === 'mid' ? t.results.needsWork : t.results.poor}</span> : t.results.notTested}
                    {' · '}
                    {t.results.threshold(metricGoodLimit(id))}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="panel mt-4 p-6">
            {lab.field ? (
              <>
                <p className="text-sm text-muted">{lab.field.origin ? t.results.vitalsFieldOrigin : t.results.vitalsField}</p>
                <div className="mt-4 grid gap-6 sm:grid-cols-3">
                  {(['lcp', 'inp', 'cls'] as const).map((id) => {
                    const m = lab.field?.[id];
                    const color = !m ? '#747482' : m.category === 'FAST' ? BAND_COLOR.good : m.category === 'AVERAGE' ? BAND_COLOR.mid : BAND_COLOR.poor;
                    return (
                      <div key={id}>
                        <p className="text-xs text-faint" dir="ltr">{t.metrics[id].name}</p>
                        <p className="num mt-1 text-2xl font-medium" style={{ color }}>{m ? formatMetric(id, m.p75) : '—'}</p>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-sm leading-relaxed text-muted">{t.results.vitalsNoField}</p>
            )}
          </div>
        </Section>
      )}

      {/* Strengths */}
      {strengths.length > 0 && (
        <Section title={t.results.strengthsTitle}>
          <ul className="grid gap-3 md:grid-cols-2">
            {strengths.map((s) => (
              <li key={s} className="flex items-start gap-3 rounded-xl border border-line bg-white/[0.02] px-4 py-3.5 text-sm text-ink/90">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3ddc97" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
                {s}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={t.results.issuesTitle} subtitle={t.results.issuesSubtitle} id="issues">
        <IssueList findings={report.findings} />
      </Section>

      {report.findings.some((f) => f.severity !== 'info' && resolveFinding(f, locale)) && (
        <Section title={t.results.planTitle} subtitle={t.results.planSubtitle}>
          <ActionPlan report={report} />
        </Section>
      )}

      <Methodology report={report} lighthouseVersion={lhVersion} />
      <StudioCta />
    </article>
  );
}
