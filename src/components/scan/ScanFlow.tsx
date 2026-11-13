'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Report } from '@/components/results/Report';
import { SiteFooter, SiteHeader } from '@/components/ui/Chrome';
import { useI18n } from '@/lib/i18n';
import type { AuditErrorCode, AuditEvent, AuditReport, AuditTaskId } from '@/types/audit';

type TaskState = 'pending' | 'running' | 'done' | 'failed';
type StageState = 'pending' | 'running' | 'done' | 'partial' | 'failed';
type StageId = 'connect' | 'performance' | 'mobile' | 'seo' | 'accessibility' | 'security' | 'recommendations';
type ClientError = AuditErrorCode | 'network';

/** Each visible stage is complete only when the real tasks behind it have settled. */
const STAGES: { id: StageId; tasks: AuditTaskId[] }[] = [
  { id: 'connect', tasks: ['connect'] },
  { id: 'performance', tasks: ['psi_mobile', 'psi_desktop'] },
  { id: 'mobile', tasks: ['psi_mobile'] },
  { id: 'seo', tasks: ['onpage', 'psi_mobile'] },
  { id: 'accessibility', tasks: ['psi_mobile'] },
  { id: 'security', tasks: ['security'] },
  { id: 'recommendations', tasks: ['scoring'] },
];

/** Share of the total work each task represents (sums to 100). */
const TASK_SHARE: Record<AuditTaskId, number> = { connect: 8, onpage: 4, security: 4, psi_mobile: 37, psi_desktop: 37, scoring: 10 };

const INITIAL: Record<AuditTaskId, TaskState> = {
  connect: 'pending',
  onpage: 'pending',
  security: 'pending',
  psi_mobile: 'pending',
  psi_desktop: 'pending',
  scoring: 'pending',
};

const CACHE_TTL = 30 * 60 * 1000;
const cacheKey = (url: string) => `bhc:report:${url.trim().toLowerCase()}`;

function readCache(url: string): AuditReport | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(url));
    if (!raw) return null;
    const report = JSON.parse(raw) as AuditReport;
    return Date.now() - new Date(report.generatedAt).getTime() < CACHE_TTL ? report : null;
  } catch {
    return null;
  }
}

function stageState(tasks: Record<AuditTaskId, TaskState>, ids: AuditTaskId[]): StageState {
  const states = ids.map((id) => tasks[id]);
  if (states.every((s) => s === 'done')) return 'done';
  if (states.every((s) => s === 'done' || s === 'failed')) return states.some((s) => s === 'done') ? 'partial' : 'failed';
  if (states.some((s) => s !== 'pending')) return 'running';
  return 'pending';
}

function StageIcon({ state }: { state: StageState }) {
  if (state === 'running') {
    return <span className="h-4 w-4 animate-spin rounded-full border-[1.5px] border-white/15 border-t-accent motion-reduce:animate-none" />;
  }
  if (state === 'done') {
    return (
      <motion.svg initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3ddc97" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </motion.svg>
    );
  }
  if (state === 'partial' || state === 'failed') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={state === 'failed' ? '#ff8f4a' : '#f2c14e'} strokeWidth="2" strokeLinecap="round">
        <path d="M12 8v5M12 16.5v.5" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    );
  }
  return <span className="h-1.5 w-1.5 rounded-full bg-white/20" />;
}

function ProgressDial({ percent }: { percent: number }) {
  const reduce = useReducedMotion();
  const r = 86;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-[220px] w-[220px]" dir="ltr">
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id="dial" x1="0" y1="0" x2="200" y2="200" gradientUnits="userSpaceOnUse">
            <stop stopColor="#a79cff" />
            <stop offset="1" stopColor="#4aa3ff" />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
        <motion.circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke="url(#dial)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * percent) / 100 }}
          transition={{ duration: reduce ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      {/* Activity sweep: shows work is happening without claiming progress. */}
      <div className="absolute inset-3 animate-[spin_2.6s_linear_infinite] rounded-full motion-reduce:hidden" style={{ background: 'conic-gradient(from 0deg, transparent 0 78%, rgba(123,108,255,0.22) 96%, transparent 100%)', mask: 'radial-gradient(circle, transparent 62%, #000 63%)', WebkitMask: 'radial-gradient(circle, transparent 62%, #000 63%)' }} aria-hidden="true" />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="num text-5xl font-semibold tracking-tight text-ink" data-testid="scan-percent">
          {Math.round(percent)}
          <span className="text-2xl text-faint">%</span>
        </span>
      </div>
    </div>
  );
}

export function ScanFlow() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const url = params.get('url') ?? '';

  const [phase, setPhase] = useState<'scanning' | 'done' | 'error'>('scanning');
  const [tasks, setTasks] = useState(INITIAL);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [error, setError] = useState<ClientError>('server_error');
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(
    async (fresh: boolean) => {
      abortRef.current?.abort();
      if (!url.trim()) {
        setError('invalid_url');
        setPhase('error');
        return;
      }
      if (!fresh) {
        const cached = readCache(url);
        if (cached) {
          setReport(cached);
          setPhase('done');
          return;
        }
      }
      const controller = new AbortController();
      abortRef.current = controller;
      setTasks(INITIAL);
      setReport(null);
      setElapsed(0);
      setPhase('scanning');

      const fail = (code: ClientError) => {
        if (controller.signal.aborted) return;
        setError(code);
        setPhase('error');
      };

      try {
        const res = await fetch('/api/audit', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body || !(res.headers.get('content-type') ?? '').includes('ndjson')) {
          const body = (await res.json().catch(() => null)) as AuditEvent | null;
          return fail(body && body.t === 'error' ? body.code : 'server_error');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finished = false;
        const handle = (line: string) => {
          if (!line.trim()) return;
          const event = JSON.parse(line) as AuditEvent;
          if (event.t === 'task') {
            const next: TaskState = event.s === 'start' ? 'running' : event.s === 'done' ? 'done' : 'failed';
            setTasks((prev) => ({ ...prev, [event.id]: next }));
          } else if (event.t === 'result') {
            finished = true;
            try {
              sessionStorage.setItem(cacheKey(url), JSON.stringify(event.report));
            } catch {
              /* storage unavailable: the report still shows */
            }
            setReport(event.report);
            setPhase('done');
          } else if (event.t === 'error') {
            finished = true;
            fail(event.code);
          }
        };
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          lines.forEach(handle);
        }
        if (buffer) handle(buffer);
        if (!finished) fail('network');
      } catch {
        fail('network');
      }
    },
    [url],
  );

  useEffect(() => {
    void start(false);
    return () => abortRef.current?.abort();
  }, [start]);

  useEffect(() => {
    if (phase !== 'scanning') return;
    const began = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - began) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const percent = (Object.keys(TASK_SHARE) as AuditTaskId[]).reduce(
    (sum, id) => sum + (tasks[id] === 'done' || tasks[id] === 'failed' ? TASK_SHARE[id] : 0),
    0,
  );
  // 100% is reserved for the moment the report has actually arrived.
  const shown = Math.min(percent, 99);
  const host = (() => {
    try {
      return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).host;
    } catch {
      return url;
    }
  })();

  return (
    <>
      <SiteHeader />
      <main className="min-h-[70dvh]">
        <AnimatePresence mode="wait">
          {phase === 'scanning' && (
            <motion.section key="scan" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="container-page py-12 md:py-20" data-testid="scan-screen">
              <div className="mx-auto max-w-4xl">
                <p className="eyebrow text-center">{t.scan.title}</p>
                <h1 className="num mt-3 break-all text-center text-2xl font-medium text-ink md:text-4xl">{host}</h1>

                <div className="panel mt-10 grid items-center gap-8 p-6 md:grid-cols-[auto_1fr] md:gap-14 md:p-10">
                  <div className="flex flex-col items-center gap-4">
                    <ProgressDial percent={shown} />
                    <p className="text-xs tabular-nums text-faint" aria-live="off">
                      {t.scan.elapsed(elapsed)}
                    </p>
                  </div>
                  <ol className="space-y-1" aria-label={t.scan.progress}>
                    {STAGES.map((stage, i) => {
                      const state = stageState(tasks, stage.tasks);
                      return (
                        <motion.li
                          key={stage.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.05 * i, duration: 0.4 }}
                          className={`flex items-center gap-4 rounded-xl px-4 py-3 transition-colors duration-500 ${state === 'running' ? 'bg-white/[0.04]' : ''}`}
                          data-stage={stage.id}
                          data-state={state}
                        >
                          <span className="flex h-5 w-5 items-center justify-center">
                            <StageIcon state={state} />
                          </span>
                          <span className={`flex-1 text-[15px] transition-colors duration-500 ${state === 'pending' ? 'text-faint' : 'text-ink'}`}>{t.scan.stages[stage.id]}</span>
                          <span className={`text-xs ${state === 'failed' ? 'text-bad' : state === 'partial' ? 'text-warn' : 'text-faint'}`}>{t.scan.state[state]}</span>
                        </motion.li>
                      );
                    })}
                  </ol>
                </div>

                <p className="mx-auto mt-6 max-w-xl text-center text-sm leading-relaxed text-faint">{t.scan.hint}</p>
                <div className="mt-6 flex justify-center">
                  <Link href="/" className="btn-ghost">
                    {t.scan.cancel}
                  </Link>
                </div>
              </div>
            </motion.section>
          )}

          {phase === 'error' && (
            <motion.section key="error" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="container-page py-16 md:py-28" data-testid="scan-error" data-error={error}>
              <div className="panel mx-auto max-w-xl p-8 text-center md:p-12">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-bad/30 bg-bad/10 text-bad">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M12 7v6M12 16.5v.5" />
                    <circle cx="12" cy="12" r="9.5" />
                  </svg>
                </span>
                <h1 className="mt-6 text-2xl font-semibold text-ink">{t.scan.errorTitle}</h1>
                {host && <p className="num mt-2 break-all text-sm text-faint">{host}</p>}
                <p className="mt-4 text-base leading-relaxed text-muted" role="alert">
                  {t.scan.errors[error]}
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  {error !== 'invalid_url' && error !== 'blocked_url' && (
                    <button type="button" className="btn-ghost !border-white/30 bg-white/[0.06]" onClick={() => void start(true)} data-testid="retry">
                      {t.scan.retry}
                    </button>
                  )}
                  <Link href="/" className="btn-ghost">
                    {t.scan.back}
                  </Link>
                </div>
              </div>
            </motion.section>
          )}

          {phase === 'done' && report && (
            <motion.div key="report" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
              <Report report={report} onRescan={() => void start(true)} onNew={() => router.push('/')} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <SiteFooter />
    </>
  );
}
