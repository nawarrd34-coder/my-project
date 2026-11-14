'use client';

/* eslint-disable @next/next/no-img-element -- screenshots are data URIs from the scan */
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Chevron } from '@/components/ui/icons';
import { proDicts, criterionCopy } from '@/features/professional/copy';
import { isCovered } from '@/features/professional/recs';
import { SEVERITY_COLOR, scoreColor } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { BusinessAnalysis, Evidence, SiteCategory } from '@/types/business';
import type { CriterionResult, EvidenceBasis, PillarResult, ProfessionalScore, QualityLevel } from '@/types/professional';
import { ConfidenceBadge, Notice, shortPath } from '../business/parts';

const CATEGORIES: SiteCategory[] = [
  'ecommerce',
  'corporate',
  'law',
  'tourism',
  'restaurant',
  'real_estate',
  'medical',
  'agency',
  'technology',
  'saas',
  'portfolio',
  'consulting',
  'education',
  'construction',
  'professional_services',
  'other',
];

const LEVEL_COLOR: Record<QualityLevel, string> = {
  excellent: '#3ddc97',
  professional: '#7fd8a6',
  good: '#f2c14e',
  needs_improvement: '#ff8f4a',
  significant_issues: '#ff5468',
};

const BASIS_STYLE: Record<EvidenceBasis, string> = {
  measured: 'border-good/30 text-good/90',
  detected: 'border-[#5fb8ff]/30 text-[#9fd2ff]',
  ai: 'border-[#b9a8ff]/40 text-[#cfc4ff]',
  unverified: 'border-warn/30 text-warn/90',
  na: 'border-line-strong text-faint',
};

export function usePro() {
  const { locale } = useI18n();
  return proDicts[locale];
}

export function BasisTag({ basis }: { basis: EvidenceBasis }) {
  const d = usePro();
  return (
    <span className={`rounded-full border px-2 py-px text-[11px] ${BASIS_STYLE[basis]}`} title={d.basis[basis].hint} data-basis={basis}>
      {d.basis[basis].label}
    </span>
  );
}

function EvidenceList({ items, business }: { items: Evidence[]; business: BusinessAnalysis }) {
  const d = usePro();
  if (!items.length) return null;
  const shots = [...new Set(items.map((e) => e.screenshot).filter(Boolean))] as ('desktop' | 'mobile')[];
  return (
    <div>
      <p className="text-xs font-medium text-faint">{d.section.evidence}</p>
      <ul className="mt-1.5 space-y-1.5">
        {items.map((e, i) => (
          <li key={i} className="rounded-lg border border-line bg-black/30 px-3 py-2 text-left text-[12px] leading-relaxed" dir="ltr">
            <span className="text-muted">{e.where}</span>
            {e.value && (
              <span className="ms-2 font-mono text-ink/90 [overflow-wrap:anywhere]" dir="auto">
                {e.value}
              </span>
            )}
            <a href={e.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-0.5 block truncate font-mono text-[11px] text-faint hover:text-muted" dir="ltr">
              {shortPath(e.url)}
            </a>
          </li>
        ))}
      </ul>
      {shots.map((s) => {
        const src = business.design.screenshots[s];
        return src ? (
          <a key={s} href={src} target="_blank" rel="noopener" className="mt-2 inline-block overflow-hidden rounded-md border border-line" title={s}>
            <img src={src} alt="" className={s === 'mobile' ? 'h-28 w-auto' : 'h-24 w-auto'} />
          </a>
        ) : null;
      })}
    </div>
  );
}

// ─── Classification ─────────────────────────────────────────────────────────

export function ClassificationCard({
  business,
  pro,
  override,
  onOverride,
}: {
  business: BusinessAnalysis;
  pro: ProfessionalScore | null;
  override: SiteCategory | null;
  onOverride: (c: SiteCategory | null) => void;
}) {
  const d = usePro();
  const cl = business.classification;
  if (!cl) return null;
  const c = d.classification;
  const current = override ?? cl.category.value;
  const m = cl.model;
  const primarySignal = m.signals.find((s) => s.model === m.primary);

  return (
    <div className="space-y-4" data-testid="classification" data-category={current} data-model={m.primary ?? 'none'}>
      {cl.uncertain && !override && (
        <div className="rounded-xl border border-warn/30 bg-warn/[0.07] px-4 py-3 text-sm text-ink/90" role="status" data-testid="classification-uncertain">
          {c.uncertain}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-6">
          <p className="text-xs text-muted">{c.category}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h3 className="heading text-2xl text-ink" data-testid="category-label">
              {d.categories[current]}
            </h3>
            {override ? (
              <span className="rounded-full border border-[#5a4cf5]/50 bg-[#5a4cf5]/15 px-2.5 py-0.5 text-[11px] text-[#c9c4ff]">{c.chosen}</span>
            ) : (
              <ConfidenceBadge value={cl.category.confidence} />
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label className="text-xs text-muted" htmlFor="category-select">
              {cl.uncertain && !override ? c.confirm : c.change}
            </label>
            <select
              id="category-select"
              value={current}
              onChange={(e) => {
                const v = e.target.value as SiteCategory;
                onOverride(v === cl.category.value ? null : v);
              }}
              className="h-9 rounded-lg border border-line bg-black/40 px-3 text-sm text-ink outline-none focus:border-line-strong"
              data-testid="category-select"
            >
              {CATEGORIES.map((k) => (
                <option key={k} value={k}>
                  {d.categories[k]}
                  {k === cl.category.value ? ` (${c.detected})` : ''}
                </option>
              ))}
            </select>
            {override && (
              <button type="button" onClick={() => onOverride(null)} className="text-xs text-muted underline underline-offset-4 hover:text-ink">
                {c.reset}
              </button>
            )}
          </div>
          {cl.category.alternatives.length > 0 && !override && (
            <p className="mt-3 text-xs text-faint">
              {c.alternatives}:{' '}
              {cl.category.alternatives.map((a, i) => (
                <button key={a} type="button" onClick={() => onOverride(a)} className="text-muted underline-offset-4 hover:text-ink hover:underline">
                  {d.categories[a]}
                  {i < cl.category.alternatives.length - 1 ? '، ' : ''}
                </button>
              ))}
            </p>
          )}
          <div className="mt-4">
            <EvidenceList items={cl.category.evidence} business={business} />
          </div>
          {pro && (
            <p className="mt-4 text-xs text-faint">
              {c.criteria}: <span className="text-muted">{d.profiles[pro.profile]}</span>
            </p>
          )}
        </div>

        <div className="panel p-6">
          <p className="text-xs text-muted">{c.model}</p>
          {m.primary ? (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h3 className="heading text-2xl text-ink" data-testid="model-label">
                  {d.models[m.primary]}
                </h3>
                <ConfidenceBadge value={m.confidence} />
                {m.hybrid && <span className="rounded-full border border-line-strong px-2.5 py-0.5 text-[11px] text-muted">{c.hybrid}</span>}
              </div>
              {m.secondary.length > 0 && (
                <p className="mt-3 text-sm text-muted">
                  {c.secondary}: {m.secondary.map((s) => d.models[s]).join(' · ')}
                </p>
              )}
              {primarySignal && (
                <div className="mt-4">
                  <EvidenceList items={primarySignal.evidence.slice(0, 3)} business={business} />
                </div>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm text-muted">{c.noModel}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="panel p-5">
          <p className="text-xs text-muted">{c.conversion}</p>
          {cl.conversion ? (
            <>
              <p className="mt-2 text-sm text-ink">{d.models[cl.conversion.action]}</p>
              <p className="mt-1 text-xs text-faint">
                {c.buttonSeen}:{' '}
                {cl.conversion.label ? (
                  <span className="text-muted" dir="auto">
                    «{cl.conversion.label}»
                  </span>
                ) : (
                  c.noButton
                )}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-faint">—</p>
          )}
        </div>
        <div className="panel p-5">
          <p className="text-xs text-muted">{c.services}</p>
          {cl.services.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {cl.services.map((s) => (
                <span key={s.name} className="rounded-full border border-line px-2.5 py-0.5 text-[12px] text-ink/90" dir="auto" title={s.source}>
                  {s.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs leading-relaxed text-faint">{current === 'ecommerce' ? '—' : c.noServices}</p>
          )}
        </div>
        <div className="panel p-5">
          <p className="text-xs text-muted">{c.audience}</p>
          {cl.audience ? (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink">
              {d.audience[cl.audience.value]} <ConfidenceBadge value={cl.audience.confidence} />
            </p>
          ) : (
            <p className="mt-2 text-sm text-faint">—</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Professionalism score ──────────────────────────────────────────────────

function CriterionRow({ c, business, covered }: { c: CriterionResult; business: BusinessAnalysis; covered: Set<string> }) {
  const d = usePro();
  const [open, setOpen] = useState(false);
  const copy = criterionCopy(useI18n().locale, c.id);
  if (!copy) return null;
  const status = c.status === 'scored' ? null : c.status === 'na' ? d.section.na : d.section.untested;
  const observed = c.status === 'scored' ? copy.observed(c.params, c.score) : (c.reason && d.reasons[c.reason]) || '';
  return (
    <li className="border-t border-line first:border-t-0" data-criterion={c.id} data-status={c.status} data-score={c.score ?? 'na'}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-3 px-5 py-3.5 text-start">
        <span className="h-6 w-1 shrink-0 rounded-full" style={{ background: c.severity ? SEVERITY_COLOR[c.severity] : c.score !== null ? scoreColor(c.score) : 'rgba(255,255,255,0.12)' }} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] text-ink">{copy.name}</span>
          <span className="mt-1 block truncate text-xs text-faint">{observed}</span>
        </span>
        <BasisTag basis={c.basis} />
        <span className="num w-14 shrink-0 text-end text-sm" style={{ color: c.score === null ? undefined : scoreColor(c.score) }}>
          {c.score ?? <span className="text-[11px] text-faint">{c.status === 'na' ? '—' : status}</span>}
        </span>
        <span className="text-faint">
          <Chevron open={open} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="grid gap-4 px-5 pb-5 md:grid-cols-2 md:ps-9">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-faint">{d.section.observed}</p>
                  <p className="mt-1 text-sm text-ink/90">{observed}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-faint">{d.section.rule}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">{copy.rule}</p>
                  <p className="mt-1 text-[11px] text-faint">{d.section.share(c.weight)}</p>
                </div>
                {c.status === 'scored' && c.score !== null && c.score < 100 && (
                  <>
                    <div>
                      <p className="text-xs font-medium text-faint">{d.section.why}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-ink/85">{copy.why}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-faint">{d.section.fix}</p>
                      {isCovered(c, covered) ? (
                        <a href="#recommendations" className="mt-1 inline-block text-[13px] text-[#9fb4ff] underline underline-offset-4">
                          {d.section.seeRec}
                        </a>
                      ) : (
                        <p className="mt-1 text-[13px] leading-relaxed text-ink/85">{copy.fix}</p>
                      )}
                    </div>
                  </>
                )}
              </div>
              <EvidenceList items={c.evidence} business={business} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function PillarCard({ p, pro, business, covered }: { p: PillarResult; pro: ProfessionalScore; business: BusinessAnalysis; covered: Set<string> }) {
  const d = usePro();
  const [open, setOpen] = useState(false);
  const items = pro.criteria.filter((c) => c.pillar === p.id);
  return (
    <div className="panel overflow-hidden" data-pillar={p.id} data-score={p.score ?? 'na'}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="w-full px-5 py-4 text-start">
        <div className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium text-ink">{d.pillars[p.id].name}</span>
            <span className="mt-0.5 block text-xs text-faint">
              {d.section.weight(p.weight)} · {d.section.criteria(items.length)}
              {p.status === 'partial' && ` · ${d.section.partial}`}
            </span>
          </span>
          <span className="num text-xl font-medium" style={{ color: p.score === null ? undefined : scoreColor(p.score) }}>
            {p.score ?? <span className="text-xs font-normal text-faint">{d.section.untested}</span>}
          </span>
          <span className="text-faint">
            <Chevron open={open} />
          </span>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.07]">
          {p.score !== null && <div className="h-full rounded-full" style={{ width: `${p.score}%`, background: scoreColor(p.score) }} />}
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden border-t border-line">
            <p className="px-5 pt-3 text-xs text-faint">{d.pillars[p.id].desc}</p>
            <ul className="mt-1">
              {items.map((c) => (
                <CriterionRow key={c.id} c={c} business={business} covered={covered} />
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ProfessionalSection({ pro, business, covered }: { pro: ProfessionalScore; business: BusinessAnalysis; covered: Set<string> }) {
  const d = usePro();
  const o = pro.overall;
  const ranked = pro.pillars.filter((p) => p.score !== null).sort((a, b) => b.score! - a.score!);
  const strongest = ranked.slice(0, 2);
  const weakest = ranked.slice(-2).reverse().filter((p) => !strongest.includes(p));
  return (
    <div className="space-y-4" data-testid="professional" data-profile={pro.profile} data-score={o.score ?? 'na'}>
      <div className="panel relative overflow-hidden p-6 md:p-8">
        <div className="pointer-events-none absolute -top-40 end-0 h-72 w-72 rounded-full blur-[110px]" style={{ background: `${o.level ? LEVEL_COLOR[o.level] : '#2f6bff'}22` }} aria-hidden="true" />
        <div className="relative flex flex-wrap items-center gap-8">
          <div className="text-center">
            <p className="num-display text-[84px] leading-none text-ink md:text-[104px]" data-testid="professional-score">
              {o.score ?? <span className="text-faint">—</span>}
              {o.score !== null && <span className="ms-1 text-[0.28em] font-bold text-faint">/100</span>}
            </p>
            {o.level ? (
              <span className="mt-3 inline-block rounded-full px-4 py-1.5 text-sm font-semibold" style={{ color: LEVEL_COLOR[o.level], background: `${LEVEL_COLOR[o.level]}1a` }} data-testid="professional-level">
                {d.levels[o.level]}
              </span>
            ) : (
              <p className="mt-2 max-w-[220px] text-xs text-warn">{d.section.noOverall}</p>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-3 text-sm">
            <p className="text-muted">
              {d.section.profile}: <span className="text-ink">{d.profiles[pro.profile]}</span> · <span className="text-ink">{d.categories[pro.category]}</span>
            </p>
            <p className="text-xs text-faint">{d.section.coverage(o.coveredWeight)}</p>
            {strongest.length > 0 && (
              <p className="text-xs text-muted">
                <span className="text-good">{d.section.strongest}:</span> {strongest.map((p) => `${d.pillars[p.id].name} (${p.score})`).join(' · ')}
              </p>
            )}
            {weakest.length > 0 && (
              <p className="text-xs text-muted">
                <span className="text-[#ff8f4a]">{d.section.weakest}:</span> {weakest.map((p) => `${d.pillars[p.id].name} (${p.score})`).join(' · ')}
              </p>
            )}
            <p className="text-[11px] leading-relaxed text-faint">{d.section.levelsNote}</p>
          </div>
        </div>
      </div>
      <div className="grid items-start gap-3 md:grid-cols-2">
        {pro.pillars.map((p) => (
          <PillarCard key={p.id} p={p} pro={pro} business={business} covered={covered} />
        ))}
      </div>
      <Notice>{d.section.visualNote}</Notice>
    </div>
  );
}
