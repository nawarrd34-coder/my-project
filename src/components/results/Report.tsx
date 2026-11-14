'use client';

import { motion } from 'motion/react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CategoryIcon } from '@/components/ui/icons';
import { GlassOrb } from '@/components/brand/GlassOrb';
import { CountUp } from '@/components/ui/CountUp';
import { MiniRing } from '@/components/ui/ScoreGauge';
import { resolveFinding, resolveStrength } from '@/features/recommendations/content';
import { BAND_COLOR, formatDate, formatMetric, GRADE_COLOR, metricBand, metricGoodLimit, scoreColor } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useBiz } from '@/lib/i18n/useBiz';
import type { AuditReport, CategoryId, CategoryResult, MetricId, StrategyData } from '@/types/audit';
import {
  BusinessOverview,
  JourneySection,
  PlatformSection,
  ProductsSection,
  Recommendations,
  SearchSection,
  StructureSection,
  VisualSection,
} from './business/Sections';
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

type PdfState = { kind: 'idle' } | { kind: 'busy' } | { kind: 'done'; href: string; name: string } | { kind: 'failed'; reason: string };

/** Reads the server's error code, falling back to the HTTP status. */
async function pdfError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string };
    if (j.error) return j.error === 'invalid_json' ? 'invalid_report' : j.error;
  } catch {
    /* not JSON */
  }
  return res.status === 429 ? 'rate_limited' : res.status === 413 ? 'too_large' : 'render_failed';
}

function usePdfDownload(report: AuditReport, locale: string) {
  const [state, setState] = useState<PdfState>({ kind: 'idle' });
  useEffect(() => () => {
    if (state.kind === 'done') URL.revokeObjectURL(state.href);
  }, [state]);

  const body = () => JSON.stringify({ report, locale });

  const download = async () => {
    setState({ kind: 'busy' });
    let res: Response;
    try {
      res = await fetch('/api/report/pdf', { method: 'POST', headers: { 'content-type': 'application/json' }, body: body() });
    } catch {
      setState({ kind: 'failed', reason: 'network' });
      return;
    }
    if (!res.ok) {
      setState({ kind: 'failed', reason: await pdfError(res) });
      return;
    }
    let blob: Blob;
    try {
      blob = await res.blob();
    } catch {
      setState({ kind: 'failed', reason: 'network' });
      return;
    }
    // Only hand over a file that really is a PDF: right type and the %PDF- signature.
    const sig = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
    const isPdf = (res.headers.get('content-type') ?? '').includes('application/pdf') && String.fromCharCode(...sig) === '%PDF-';
    if (!isPdf || blob.size < 1000) {
      setState({ kind: 'failed', reason: 'bad_file' });
      return;
    }
    const file = new Blob([blob], { type: 'application/pdf' });
    const href = URL.createObjectURL(file);
    const name = `business-health-check-${report.host}-${locale}.pdf`;
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setState({ kind: 'done', href, name });
  };

  /**
   * Fallback when the PDF cannot be rendered: the server returns the same
   * report as a printable HTML page, which the browser can save as PDF.
   * The window is opened inside the click so pop-up blockers allow it.
   */
  const openPrintable = async () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.title = '…';
    try {
      const res = await fetch('/api/report/pdf?format=html', { method: 'POST', headers: { 'content-type': 'application/json' }, body: body() });
      if (!res.ok) throw new Error(await pdfError(res));
      const html = await res.text();
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 600);
    } catch {
      win.close();
      setState({ kind: 'failed', reason: 'render_failed' });
    }
  };

  return { state, download, openPrintable };
}

function PdfStatus({ state, onPrint }: { state: PdfState; onPrint: () => void }) {
  const b = useBiz();
  if (state.kind === 'done')
    return (
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-good/30 bg-good/[0.07] px-4 py-3 text-sm text-ink" role="status" data-testid="pdf-status" data-state="done">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3ddc97" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
        <span className="flex-1">{b.pdf.ready}</span>
        <a href={state.href} target="_blank" rel="noopener" className="text-sm font-medium text-ink underline underline-offset-4" data-testid="pdf-open">
          {b.pdf.open}
        </a>
      </div>
    );
  if (state.kind === 'failed')
    return (
      <div className="mt-4 rounded-xl border border-crit/30 bg-crit/[0.07] px-4 py-3 text-sm text-ink" role="alert" data-testid="pdf-status" data-state="failed" data-reason={state.reason}>
        <p>{b.pdf.errors[state.reason] ?? b.pdf.errors.render_failed}</p>
        <p className="mt-2 text-xs text-muted">
          {b.pdf.printHint}{' '}
          <button type="button" onClick={onPrint} className="font-medium text-ink underline underline-offset-4" data-testid="pdf-print">
            {b.pdf.print}
          </button>
        </p>
      </div>
    );
  return null;
}

function ScorePanel({ report }: { report: AuditReport }) {
  const { t } = useI18n();
  const { overall } = report;
  const critical = report.findings.filter((f) => f.severity === 'critical').length;
  const high = report.findings.filter((f) => f.severity === 'high').length;
  return (
    <div className="panel relative overflow-hidden p-6 md:p-10">
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
          <h3 className="text-sm font-medium text-muted">{t.results.summaryTitle}</h3>
          <p className="heading mt-2 text-2xl text-ink md:text-[28px]">{t.results.counts(critical, high, report.findings.length)}</p>
          <h3 className="mt-8 text-sm font-medium text-muted">{t.results.categoriesTitle}</h3>
          <ul className="mt-1 divide-y divide-line">
            {report.categories.map((c, i) => (
              <CategoryRow key={c.id} c={c} index={i} />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Performance({ report }: { report: AuditReport }) {
  const { t } = useI18n();
  const mobile = report.psi.mobile.ok ? report.psi.mobile.data : null;
  const desktop = report.psi.desktop.ok ? report.psi.desktop.data : null;
  const lab = mobile ?? desktop;
  const psiError = (o: AuditReport['psi']['mobile']) => (o.ok ? undefined : t.psiErrors[o.error]);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <StrategyCard label={t.results.mobile} data={mobile} error={psiError(report.psi.mobile)} />
        <StrategyCard label={t.results.desktop} data={desktop} error={psiError(report.psi.desktop)} />
      </div>
      {(mobile || desktop) && (
        <div className="panel overflow-hidden">
          <div className="flex flex-wrap items-baseline justify-between gap-4 px-6 pt-5">
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
      )}
      {lab && (
        <>
          <p className="pt-4 text-sm font-medium text-muted">
            {t.results.vitalsTitle} <span className="ms-2 text-xs font-normal text-faint">{mobile ? t.results.vitalsLab : `${t.results.metricsNote} (${t.results.desktop})`}</span>
          </p>
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
          <div className="panel p-6">
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
        </>
      )}
    </div>
  );
}

function Strengths({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {items.map((s) => (
        <li key={s} className="flex items-start gap-3 rounded-xl border border-line bg-white/[0.02] px-4 py-3.5 text-sm text-ink/90">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3ddc97" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
          {s}
        </li>
      ))}
    </ul>
  );
}

const PERF: CategoryId[] = ['performance', 'mobile'];
const SEO_A11Y: CategoryId[] = ['seo', 'accessibility'];
const SEC: CategoryId[] = ['security'];

export function Report({ report, onRescan, onNew }: { report: AuditReport; onRescan: () => void; onNew: () => void }) {
  const { t, locale } = useI18n();
  const b = useBiz();
  const pdf = usePdfDownload(report, locale);
  const business = report.business ?? null;

  const mobile = report.psi.mobile.ok ? report.psi.mobile.data : null;
  const desktop = report.psi.desktop.ok ? report.psi.desktop.data : null;
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
  const hasPlan = report.findings.some((f) => f.severity !== 'info' && resolveFinding(f, locale));
  const s = b.sections;

  const nav: { id: string; label: string }[] = business
    ? [
        { id: 'overview', label: s.overview },
        { id: 'platform', label: s.platform },
        { id: 'structure', label: s.structure },
        { id: 'products', label: s.products },
        { id: 'visual', label: s.banners },
        { id: 'search', label: s.search },
        { id: 'journey', label: s.journey },
        { id: 'performance', label: s.performance },
        { id: 'seo', label: s.seo },
        { id: 'security', label: s.security },
        { id: 'recommendations', label: s.recs },
        { id: 'score', label: s.score },
      ]
    : [
        { id: 'score', label: s.score },
        { id: 'performance', label: s.performance },
        { id: 'seo', label: s.seo },
        { id: 'security', label: s.security },
        { id: 'recommendations', label: s.recs },
      ];
  const n = (id: string) => nav.findIndex((x) => x.id === id) + 1;

  const technical = (
    <>
      <Section id="performance" index={n('performance')} title={s.performance} subtitle={t.results.compareSubtitle}>
        <Performance report={report} />
        <div className="mt-8" id="issues">
          <IssueList findings={report.findings} categories={PERF} />
        </div>
      </Section>
      <Section id="seo" index={n('seo')} title={s.seo}>
        <IssueList findings={report.findings} categories={SEO_A11Y} />
      </Section>
      <Section id="security" index={n('security')} title={s.security}>
        <IssueList findings={report.findings} categories={SEC} />
      </Section>
    </>
  );

  const recommendations = (
    <Section id="recommendations" index={n('recommendations')} title={s.recs} subtitle={s.recsSub}>
      <Recommendations business={business} findings={report.findings} />
      {hasPlan && (
        <div className="mt-14">
          <h3 className="heading text-2xl text-ink">{t.results.planTitle}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{t.results.planSubtitle}</p>
          <div className="mt-6">
            <ActionPlan report={report} />
          </div>
        </div>
      )}
    </Section>
  );

  const score = (
    <Section id="score" index={n('score')} title={s.score} subtitle={s.scoreNote}>
      <ScorePanel report={report} />
      {strengths.length > 0 && (
        <div className="mt-10">
          <h3 className="heading mb-5 text-2xl text-ink">{t.results.strengthsTitle}</h3>
          <Strengths items={strengths} />
        </div>
      )}
    </Section>
  );

  return (
    <article className="relative container-page pb-8 pt-28 md:pt-36" data-testid="report" data-business={business ? 'yes' : 'no'}>
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <p className="eyebrow">{t.results.title}</p>
          <h1 className="display-black num mt-4 break-all text-[40px] text-ink md:text-[72px]">{report.host}</h1>
          <p className="mt-3 text-sm text-faint">
            {t.results.scannedOn}: <span className="text-muted">{formatDate(report.generatedAt, locale)}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={pdf.download} disabled={pdf.state.kind === 'busy'} aria-busy={pdf.state.kind === 'busy'} className="btn-solid h-12 px-6" data-testid="download-pdf">
            {pdf.state.kind === 'busy' ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" />
              </svg>
            )}
            {pdf.state.kind === 'busy' ? t.results.downloading : t.results.download}
          </button>
          <button type="button" onClick={onNew} className="btn-ghost h-12 px-6">
            {t.results.newScan}
          </button>
        </div>
      </header>
      <PdfStatus state={pdf.state} onPrint={pdf.openPrintable} />

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

      <nav aria-label={b.nav.overview} className="sticky top-[68px] z-20 -mx-4 mt-8 overflow-x-auto bg-bg/85 px-4 py-3 backdrop-blur-md" data-testid="section-nav">
        <ol className="flex w-max gap-2">
          {nav.map((x, i) => (
            <li key={x.id}>
              <a href={`#${x.id}`} className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-line px-3.5 py-1.5 text-[13px] text-muted transition-colors hover:border-line-strong hover:text-ink">
                <span className="num text-[11px] text-faint">{String(i + 1).padStart(2, '0')}</span>
                {x.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {business ? (
        <>
          <Section id="overview" index={1} title={s.overview} subtitle={s.overviewSub}>
            <BusinessOverview business={business} report={report} />
          </Section>
          <Section id="platform" index={2} title={s.platform} subtitle={s.platformSub}>
            <PlatformSection business={business} />
          </Section>
          <Section id="structure" index={3} title={s.structure} subtitle={s.structureSub}>
            <StructureSection business={business} />
          </Section>
          <Section id="products" index={4} title={s.products} subtitle={s.productsSub}>
            <ProductsSection business={business} />
          </Section>
          <Section id="visual" index={5} title={s.banners} subtitle={s.bannersSub}>
            <VisualSection business={business} />
          </Section>
          <Section id="search" index={6} title={s.search} subtitle={s.searchSub}>
            <SearchSection business={business} />
          </Section>
          <Section id="journey" index={7} title={s.journey} subtitle={s.journeySub}>
            <JourneySection business={business} />
            <div className="mt-8">
              <IssueList findings={report.findings} categories={['ux']} emptyText={b.none} />
            </div>
          </Section>
          {technical}
          {recommendations}
          {score}
        </>
      ) : (
        <>
          {score}
          {report.ai && (
            <div className="mt-6 rounded-xl border border-accent/25 bg-accent/[0.06] p-5">
              <p className="text-[15px] leading-relaxed text-ink/90">{report.ai[locale]}</p>
              <p className="mt-2 text-xs text-faint">{t.results.aiLabel}</p>
            </div>
          )}
          {technical}
          {recommendations}
        </>
      )}

      <Methodology report={report} lighthouseVersion={lhVersion} />
      <StudioCta />
    </article>
  );
}
