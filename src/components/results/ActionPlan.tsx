'use client';

import { useEffect, useMemo, useState } from 'react';
import SpringCheck from '@/components/reactbits/SpringCheck';
import { resolveFinding } from '@/features/recommendations/content';
import { SEVERITY_COLOR } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { AuditReport } from '@/types/audit';

const MAX_ITEMS = 10;

/** The highest-priority fixes as a checklist the team can work through. */
export function ActionPlan({ report }: { report: AuditReport }) {
  const { t, locale, dir } = useI18n();
  const storageKey = `bhc:plan:${report.id}`;
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) setDone(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const items = useMemo(() => {
    const seen = new Set<string>();
    return report.findings
      .filter((f) => f.severity !== 'info')
      .map((f, i) => ({ key: `${f.id}-${i}`, finding: f, copy: resolveFinding(f, locale) }))
      .filter((x) => {
        if (!x.copy || seen.has(x.copy.fix)) return false;
        seen.add(x.copy.fix);
        return true;
      })
      .slice(0, MAX_ITEMS);
  }, [report.findings, locale]);

  const toggle = (key: string, checked: boolean) => {
    setDone((prev) => {
      const next = { ...prev, [key]: checked };
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const completed = items.filter((i) => done[i.key]).length;

  return (
    <div className="panel p-6 md:p-8" data-testid="action-plan">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-muted">{t.results.planDone(completed, items.length)}</span>
        <div className="h-1 w-32 overflow-hidden rounded-full bg-white/[0.07]">
          <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${items.length ? (completed / items.length) * 100 : 0}%` }} />
        </div>
      </div>
      <ul className="mt-4 divide-y divide-line">
        {items.map(({ key, finding, copy }) => (
          <li key={key} className="flex items-start gap-3 py-3">
            <div className="min-w-0 flex-1">
              <SpringCheck
                label={copy!.title}
                checked={!!done[key]}
                onChange={(checked: boolean) => toggle(key, checked)}
                color="#f5f5f7"
                fillColor="#7b6cff"
                checkColor="#ffffff"
                boxSize={22}
                boxRadius={7}
                fontSize={15}
                strike={dir === 'rtl' ? 'right' : 'left'}
              />
              <p className={`ps-[32px] text-sm leading-relaxed text-muted transition-opacity ${done[key] ? 'opacity-40' : ''}`}>{copy!.fix}</p>
            </div>
            <span className="mt-3.5 shrink-0 text-xs font-medium" style={{ color: SEVERITY_COLOR[finding.severity] }}>
              {t.severity[finding.severity]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
