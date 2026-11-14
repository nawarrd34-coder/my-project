'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { Chevron } from '@/components/ui/icons';
import { resolveFinding } from '@/features/recommendations/content';
import { CATEGORY_ORDER } from '@/features/scoring/engine';
import { SEVERITY_COLOR } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { CategoryId, Finding } from '@/types/audit';

function Field({ label, children, mono }: { label: string; children: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium text-faint">{label}</dt>
      <dd className={`mt-1.5 text-sm leading-relaxed text-ink/90 ${mono ? 'rounded-lg border border-line bg-black/30 px-3 py-2 font-mono text-[13px] [overflow-wrap:anywhere]' : ''}`} dir={mono ? 'auto' : undefined}>
        {children}
      </dd>
    </div>
  );
}

export function IssueList({ findings, categories, emptyText }: { findings: Finding[]; categories?: CategoryId[]; emptyText?: string }) {
  const { t, locale } = useI18n();
  const [filter, setFilter] = useState<CategoryId | 'all'>('all');
  const [open, setOpen] = useState<string | null>(null);

  const items = useMemo(
    () =>
      findings
        .filter((f) => !categories || categories.includes(f.category))
        .map((f, i) => ({ key: `${f.id}-${i}`, finding: f, copy: resolveFinding(f, locale) }))
        .filter((x): x is typeof x & { copy: NonNullable<typeof x.copy> } => x.copy !== null),
    [findings, locale, categories],
  );
  const present = CATEGORY_ORDER.filter((c) => items.some((i) => i.finding.category === c));
  const shown = filter === 'all' ? items : items.filter((i) => i.finding.category === filter);

  if (items.length === 0) return <p className="text-sm text-muted">{emptyText ?? t.results.counts(0, 0, 0)}</p>;

  return (
    <div>
      <div className={`flex flex-wrap gap-2 ${present.length < 2 ? 'hidden' : ''}`} role="tablist" aria-label={t.results.issuesTitle}>
        {(['all', ...present] as const).map((id) => {
          const count = id === 'all' ? items.length : items.filter((i) => i.finding.category === id).length;
          const active = filter === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(id)}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] transition-colors ${active ? 'border-white/30 bg-white/[0.08] text-ink' : 'border-line text-muted hover:text-ink'}`}
            >
              {id === 'all' ? t.results.filterAll : t.categories[id].name}
              <span className="num ms-2 text-faint">{count}</span>
            </button>
          );
        })}
      </div>

      <ul className="mt-5 space-y-2.5" data-testid="issues">
        {shown.map(({ key, finding, copy }) => {
          const isOpen = open === key;
          const color = SEVERITY_COLOR[finding.severity];
          return (
            <li key={key} className="panel overflow-hidden" data-finding={finding.id} data-severity={finding.severity}>
              <button type="button" onClick={() => setOpen(isOpen ? null : key)} aria-expanded={isOpen} className="flex w-full items-center gap-4 px-5 py-4 text-start">
                <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium text-ink">{copy.title}</span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="font-medium" style={{ color }}>{t.severity[finding.severity]}</span>
                    <span className="text-faint">{t.categories[finding.category].name}</span>
                    <span className={`rounded-full border px-2 py-px ${finding.basis === 'verified' ? 'border-good/25 text-good/90' : 'border-line-strong text-muted'}`} title={finding.basis === 'verified' ? t.basis.verifiedHint : t.basis.inferredHint}>
                      {t.basis[finding.basis]}
                    </span>
                  </span>
                </span>
                <span className="text-faint">
                  <Chevron open={isOpen} />
                </span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
                    <dl className="grid gap-5 border-t border-line px-5 py-5 md:grid-cols-2 md:ps-10">
                      <Field label={t.results.explanation}>{copy.explanation}</Field>
                      <Field label={t.results.business}>{copy.business}</Field>
                      <Field label={t.results.evidence} mono>{copy.evidence}</Field>
                      <Field label={t.results.fix}>{copy.fix}</Field>
                    </dl>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
        {shown.length === 0 && <li className="text-sm text-muted">{t.results.noIssues}</li>}
      </ul>
    </div>
  );
}
