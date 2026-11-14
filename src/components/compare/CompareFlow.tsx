'use client';

/* eslint-disable @next/next/no-img-element -- screenshots are data URIs from the scan */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { proDicts } from '@/features/professional/copy';
import { scoreProfessional } from '@/features/professional/score';
import { CATEGORY_ORDER } from '@/features/scoring/engine';
import { readCachedReport, runAudit, writeCachedReport } from '@/lib/auditClient';
import { scoreColor } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { SiteFooter, SiteHeader } from '@/components/ui/Chrome';
import { looksLikeUrl } from '@/components/ui/UrlForm';
import type { AuditErrorCode, AuditReport, AuditTaskId } from '@/types/audit';
import type { PillarId } from '@/types/professional';

/**
 * Competitor comparison: two independent audits with the same method, shown
 * side by side. Colours: green = my website ahead, red = competitor ahead,
 * yellow = within 3 points, grey = not tested for one of them.
 */

type Side = 'mine' | 'theirs';
type SideState =
  | { phase: 'idle' }
  | { phase: 'running'; done: number }
  | { phase: 'done'; report: AuditReport }
  | { phase: 'error'; error: AuditErrorCode | 'network' };

const TOTAL_TASKS = 11;
const ACCENT: Record<Side, string> = { mine: '#4f86ff', theirs: '#b98cff' };
const SIMILAR = 3;

const normalise = (v: string) => v.trim();

function diffColor(a: number | null, b: number | null) {
  if (a === null || b === null) return { tone: 'untested' as const, color: '#747482' };
  const d = a - b;
  if (Math.abs(d) <= SIMILAR) return { tone: 'similar' as const, color: '#f2c14e' };
  return d > 0 ? { tone: 'better' as const, color: '#3ddc97' } : { tone: 'worse' as const, color: '#ff5468' };
}

function Field({ side, value, onChange, error }: { side: Side; value: string; onChange: (v: string) => void; error: boolean }) {
  const { t } = useI18n();
  const id = `compare-${side}`;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-2 flex items-center gap-2 text-sm font-medium text-ink">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: ACCENT[side], boxShadow: `0 0 10px ${ACCENT[side]}` }} />
        {side === 'mine' ? t.compare.mine : t.compare.theirs}
      </label>
      <input
        id={id}
        dir="ltr"
        type="text"
        inputMode="url"
        autoComplete="url"
        autoCapitalize="none"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={side === 'mine' ? t.compare.minePlaceholder : t.compare.theirsPlaceholder}
        aria-invalid={error}
        className="h-14 w-full rounded-2xl border bg-black/30 px-4 text-left text-[16px] text-ink outline-none transition-colors placeholder:text-[#7d8aa8] focus:bg-black/40"
        style={{ borderColor: error ? '#ff5468' : `${ACCENT[side]}66` }}
        data-testid={`compare-input-${side}`}
      />
    </div>
  );
}

function Progress({ side, url, state, onRetry }: { side: Side; url: string; state: SideState; onRetry: () => void }) {
  const { t } = useI18n();
  const pct = state.phase === 'running' ? Math.min(95, Math.round((state.done / TOTAL_TASKS) * 100)) : state.phase === 'done' ? 100 : 0;
  return (
    <div className="panel p-5" data-testid={`compare-progress-${side}`} data-phase={state.phase}>
      <p className="flex items-center gap-2 text-xs text-muted">
        <span className="h-2 w-2 rounded-full" style={{ background: ACCENT[side] }} />
        {side === 'mine' ? t.compare.mine : t.compare.theirs}
      </p>
      <p className="mt-2 truncate font-mono text-sm text-ink" dir="ltr">
        {url}
      </p>
      {state.phase === 'error' ? (
        <div className="mt-3 text-sm" role="alert">
          <p className="text-[#ff8f4a]">{t.compare.failed}</p>
          <p className="mt-1 text-xs text-muted">{t.scan.errors[state.error as keyof typeof t.scan.errors] ?? t.scan.errors.server_error}</p>
          <button type="button" onClick={onRetry} className="btn-ghost mt-3 h-9 px-4 text-xs">
            {t.compare.retry}
          </button>
        </div>
      ) : (
        <>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
            <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: ACCENT[side] }} />
          </div>
          <p className="num mt-2 text-xs text-faint">
            {state.phase === 'done' ? '100%' : `${t.compare.analysing}… ${pct}%`}
          </p>
        </>
      )}
    </div>
  );
}

function Row({ label, a, b }: { label: string; a: number | null; b: number | null }) {
  const { t } = useI18n();
  const { tone, color } = diffColor(a, b);
  const cell = (v: number | null) => (v === null ? <span className="text-xs text-faint">{t.compare.notComparable}</span> : <span style={{ color: scoreColor(v) }}>{v}</span>);
  return (
    <tr className="border-t border-line" data-compare-row={label} data-tone={tone}>
      <td className="px-4 py-3 ps-5 text-sm text-ink">{label}</td>
      <td className="num px-3 py-3 text-center text-lg">{cell(a)}</td>
      <td className="num px-3 py-3 text-center text-lg">{cell(b)}</td>
      <td className="px-4 py-3 pe-5">
        <span className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs" style={{ color, background: `${color}1a` }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
          {a === null || b === null ? t.compare.legend.untested : t.compare.diff(a - b)}
        </span>
      </td>
    </tr>
  );
}

function Results({ mine, theirs, urls }: { mine: AuditReport; theirs: AuditReport; urls: Record<Side, string> }) {
  const { t, locale } = useI18n();
  const d = proDicts[locale];
  const pa = useMemo(() => scoreProfessional(mine), [mine]);
  const pb = useMemo(() => scoreProfessional(theirs), [theirs]);
  const pillarIds = [...new Set([...(pa?.pillars ?? []), ...(pb?.pillars ?? [])].map((p) => p.id))] as PillarId[];
  const shared = pillarIds.filter((id) => pa?.pillars.some((p) => p.id === id) && pb?.pillars.some((p) => p.id === id));
  const pillarScore = (p: typeof pa, id: PillarId) => p?.pillars.find((x) => x.id === id)?.score ?? null;
  const catScore = (r: AuditReport, id: (typeof CATEGORY_ORDER)[number]) => r.categories.find((c) => c.id === id)?.score ?? null;

  const card = (side: Side, r: AuditReport, p: typeof pa) => {
    const shots = r.business?.design.screenshots;
    return (
      <div className="panel overflow-hidden" data-testid={`compare-card-${side}`}>
        <div className="h-1" style={{ background: ACCENT[side] }} />
        <div className="p-5">
          <p className="flex items-center gap-2 text-xs text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: ACCENT[side] }} />
            {side === 'mine' ? t.compare.mine : t.compare.theirs}
          </p>
          <p className="mt-2 truncate text-lg font-medium text-ink" dir="auto">
            {r.business?.identity.brandName?.value ?? r.host}
          </p>
          <p className="truncate font-mono text-xs text-faint" dir="ltr">
            {r.host}
          </p>
          {p && <p className="mt-2 text-xs text-muted">{d.categories[p.category]}</p>}
          <div className="mt-4 flex gap-6">
            <div>
              <p className="num-display text-4xl" style={{ color: p?.overall.score != null ? scoreColor(p.overall.score) : undefined }}>
                {p?.overall.score ?? '—'}
              </p>
              <p className="text-[11px] text-faint">{t.compare.professional}</p>
            </div>
            <div>
              <p className="num-display text-4xl" style={{ color: r.overall.score !== null ? scoreColor(r.overall.score) : undefined }}>
                {r.overall.score ?? '—'}
              </p>
              <p className="text-[11px] text-faint">{t.compare.technical}</p>
            </div>
          </div>
          {shots?.desktop && <img src={shots.desktop} alt="" className="mt-4 w-full rounded-lg border border-line" />}
          <Link href={`/scan?url=${encodeURIComponent(urls[side])}`} className="btn-ghost mt-4 h-10 w-full justify-center text-sm" data-testid={`compare-open-${side}`}>
            {t.compare.fullReport}
          </Link>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-12 space-y-6" data-testid="compare-results">
      <h2 className="display text-[28px] text-ink md:text-[40px]">{t.compare.results}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {card('mine', mine, pa)}
        {card('theirs', theirs, pb)}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
        {(['better', 'worse', 'similar', 'untested'] as const).map((k) => (
          <span key={k} className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: { better: '#3ddc97', worse: '#ff5468', similar: '#f2c14e', untested: '#747482' }[k] }} />
            {t.compare.legend[k]}
          </span>
        ))}
      </div>

      {pa && pb && pa.profile !== pb.profile && <p className="rounded-xl border border-warn/25 bg-warn/[0.06] px-4 py-3 text-sm text-ink/90">{t.compare.differentTypes(d.categories[pa.category], d.categories[pb.category])}</p>}

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr className="text-xs text-faint">
              <th className="px-4 py-3 ps-5 text-start font-normal">{t.compare.metric}</th>
              <th className="px-3 py-3 font-normal" style={{ color: ACCENT.mine }}>
                {t.compare.mine}
              </th>
              <th className="px-3 py-3 font-normal" style={{ color: ACCENT.theirs }}>
                {t.compare.theirs}
              </th>
              <th className="px-4 py-3 pe-5 text-start font-normal">{t.compare.difference}</th>
            </tr>
          </thead>
          <tbody>
            <Row label={t.compare.professional} a={pa?.overall.score ?? null} b={pb?.overall.score ?? null} />
            <Row label={t.compare.technical} a={mine.overall.score} b={theirs.overall.score} />
            <tr>
              <td colSpan={4} className="px-5 pb-1 pt-5 text-xs font-medium text-muted">
                {t.compare.pillarsTitle}
              </td>
            </tr>
            {shared.map((id) => (
              <Row key={id} label={d.pillars[id].name} a={pillarScore(pa, id)} b={pillarScore(pb, id)} />
            ))}
            <tr>
              <td colSpan={4} className="px-5 pb-1 pt-5 text-xs font-medium text-muted">
                {t.compare.technicalTitle}
              </td>
            </tr>
            {CATEGORY_ORDER.map((id) => (
              <Row key={id} label={t.categories[id].name} a={catScore(mine, id)} b={catScore(theirs, id)} />
            ))}
          </tbody>
        </table>
      </div>

      {(mine.business?.design.screenshots.mobile || theirs.business?.design.screenshots.mobile) && (
        <div className="panel p-5">
          <p className="text-xs text-muted">{t.compare.screenshots}</p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            {([['mine', mine], ['theirs', theirs]] as const).map(([side, r]) => (
              <figure key={side} className="mx-auto w-full max-w-[220px]">
                {r.business?.design.screenshots.mobile ? (
                  <img src={r.business.design.screenshots.mobile} alt="" className="w-full rounded-[18px] border-2" style={{ borderColor: `${ACCENT[side]}88` }} />
                ) : (
                  <div className="flex aspect-[390/844] items-center justify-center rounded-[18px] border border-line text-xs text-faint">{t.compare.notComparable}</div>
                )}
                <figcaption className="mt-2 truncate text-center font-mono text-[11px] text-faint" dir="ltr">
                  {r.host}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs leading-relaxed text-faint">{t.compare.scope}</p>
    </div>
  );
}

export function CompareFlow() {
  const { t } = useI18n();
  const router = useRouter();
  const [urls, setUrls] = useState<Record<Side, string>>({ mine: '', theirs: '' });
  const [errors, setErrors] = useState<Record<Side, boolean>>({ mine: false, theirs: false });
  const [message, setMessage] = useState<string | null>(null);
  const [active, setActive] = useState<Record<Side, string> | null>(null);
  const [state, setState] = useState<Record<Side, SideState>>({ mine: { phase: 'idle' }, theirs: { phase: 'idle' } });
  const controllers = useRef<Partial<Record<Side, AbortController>>>({});

  const run = useCallback(async (side: Side, url: string) => {
    controllers.current[side]?.abort();
    const cached = readCachedReport(url);
    if (cached) {
      setState((s) => ({ ...s, [side]: { phase: 'done', report: cached } }));
      return;
    }
    const controller = new AbortController();
    controllers.current[side] = controller;
    const seen = new Set<AuditTaskId>();
    setState((s) => ({ ...s, [side]: { phase: 'running', done: 0 } }));
    const out = await runAudit(url, {
      signal: controller.signal,
      onTask: (id, st) => {
        if (st === 'start') return;
        seen.add(id);
        setState((s) => ({ ...s, [side]: { phase: 'running', done: seen.size } }));
      },
    });
    if (controller.signal.aborted) return;
    if (out.ok) {
      writeCachedReport(url, out.report);
      setState((s) => ({ ...s, [side]: { phase: 'done', report: out.report } }));
    } else {
      setState((s) => ({ ...s, [side]: { phase: 'error', error: out.error } }));
    }
  }, []);

  useEffect(() => () => Object.values(controllers.current).forEach((c) => c?.abort()), []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const mine = normalise(urls.mine);
    const theirs = normalise(urls.theirs);
    const bad = { mine: !!mine && !looksLikeUrl(mine), theirs: !!theirs && !looksLikeUrl(theirs) };
    if (!mine && !theirs) bad.mine = true;
    setErrors(bad);
    if (bad.mine || bad.theirs) {
      setMessage(t.compare.invalid);
      return;
    }
    // One address only: open the full single-site analysis.
    if (!mine || !theirs) {
      setMessage(t.compare.oneOnly);
      router.push(`/scan?url=${encodeURIComponent(mine || theirs)}`);
      return;
    }
    if (mine.toLowerCase().replace(/\/+$/, '') === theirs.toLowerCase().replace(/\/+$/, '')) {
      setErrors({ mine: false, theirs: true });
      setMessage(t.compare.same);
      return;
    }
    setMessage(null);
    const next = { mine, theirs };
    setActive(next);
    void run('mine', mine);
    void run('theirs', theirs);
  };

  const busy = state.mine.phase === 'running' || state.theirs.phase === 'running';

  return (
    <>
      <SiteHeader cta={false} />
      <main className="container-page pb-16 pt-28 md:pt-36" data-testid="compare-page">
        <p className="eyebrow">{t.compare.eyebrow}</p>
        <h1 className="display mt-4 max-w-3xl text-balance text-[34px] text-ink md:text-[56px]">{t.compare.title}</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">{t.compare.subtitle}</p>

        <form onSubmit={submit} noValidate className="panel mt-10 p-5 md:p-7" data-testid="compare-form">
          <div className="grid gap-5 md:grid-cols-2">
            <Field side="mine" value={urls.mine} error={errors.mine} onChange={(v) => setUrls((u) => ({ ...u, mine: v }))} />
            <Field side="theirs" value={urls.theirs} error={errors.theirs} onChange={(v) => setUrls((u) => ({ ...u, theirs: v }))} />
          </div>
          {message && (
            <p className="mt-4 text-sm text-warn" role="alert" data-testid="compare-message">
              {message}
            </p>
          )}
          <div className="mt-6 flex flex-col items-center gap-3">
            <button type="submit" disabled={busy} className="btn-solid h-14 w-full max-w-md justify-center text-[16px] font-bold" data-testid="compare-submit">
              {t.compare.cta}
            </button>
            <p className="text-center text-[11px] text-faint">{t.compare.rateNote}</p>
          </div>
        </form>

        {active && (
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Progress side="mine" url={active.mine} state={state.mine} onRetry={() => run('mine', active.mine)} />
            <Progress side="theirs" url={active.theirs} state={state.theirs} onRetry={() => run('theirs', active.theirs)} />
          </div>
        )}

        {active && state.mine.phase === 'done' && state.theirs.phase === 'done' && <Results mine={state.mine.report} theirs={state.theirs.report} urls={active} />}
      </main>
      <SiteFooter />
    </>
  );
}
