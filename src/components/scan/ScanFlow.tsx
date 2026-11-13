'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Report } from '@/components/results/Report';
import { GlassOrb } from '@/components/brand/GlassOrb';
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

/** The orb at the centre of the scan; the ring around it is the real share of finished work. */
function OrbProgress({ percent }: { percent: number }) {
  const reduce = useReducedMotion();
  const r = 148;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative mx-auto h-[300px] w-[300px] sm:h-[340px] sm:w-[340px]" dir="ltr">
      <div className="absolute inset-0 flex items-center justify-center">
        <GlassOrb size={340} energy={1} label={`${Math.round(percent)}%`} />
      </div>
      <svg viewBox="0 0 320 320" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id="scan-ring" x1="0" y1="0" x2="320" y2="320" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2f6bff" />
            <stop offset="0.6" stopColor="#7c4dff" />
            <stop offset="1" stopColor="#b9a8ff" />
          </linearGradient>
        </defs>
        <circle cx="160" cy="160" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
        <motion.circle
          cx="160"
          cy="160"
          r={r}
          fill="none"
          stroke="url(#scan-ring)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * percent) / 100 }}
          transition={{ duration: reduce ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
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
      <main className="relative min-h-[80dvh] overflow-hidden">
        <div className="top-light" aria-hidden="true" />
        <AnimatePresence mode="wait">
          {phase === 'scanning' && (
            <motion.section key="scan" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="relative container-page pb-16 pt-28 md:pb-24 md:pt-32" data-testid="scan-screen">
              <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
                <div className="flex flex-col items-center text-center">
                  <OrbProgress percent={shown} />
                  <p className="num-display mt-4 text-[64px] leading-none text-ink md:text-[80px]" data-testid="scan-percent">
                    {Math.round(shown)}
                    <span className="text-[0.45em] text-faint">%</span>
                  </p>
                  <p className="mt-3 text-xs tabular-nums text-faint" aria-live="off">
                    {t.scan.elapsed(elapsed)}
                  </p>
                </div>

                <div>
                  <p className="eyebrow">{t.scan.title}</p>
                  <h1 className="display num mt-4 break-all text-start text-[34px] text-ink md:text-5xl">{host}</h1>
                  <ol className="relative mt-10" aria-label={t.scan.progress}>
                    <span className="absolute bottom-3 start-[11px] top-3 w-px bg-line" aria-hidden="true" />
                    {STAGES.map((stage, i) => {
                      const state = stageState(tasks, stage.tasks);
                      return (
                        <motion.li
                          key={stage.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.05 * i, duration: 0.4 }}
                          className="relative flex items-center gap-5 py-3"
                          data-stage={stage.id}
                          data-state={state}
                        >
                          <span className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border bg-bg transition-colors duration-500 ${state === 'running' ? 'border-[#5a4cf5]/60 shadow-[0_0_16px_rgba(90,76,245,.6)]' : 'border-line'}`}>
                            <StageIcon state={state} />
                          </span>
                          <span className={`heading flex-1 text-[17px] transition-colors duration-500 md:text-lg ${state === 'pending' ? 'text-white/30' : 'text-ink'}`}>{t.scan.stages[stage.id]}</span>
                          <span className={`text-xs ${state === 'failed' ? 'text-bad' : state === 'partial' ? 'text-warn' : state === 'running' ? 'text-[#9fb4ff]' : 'text-faint'}`}>{t.scan.state[state]}</span>
                        </motion.li>
                      );
                    })}
                  </ol>
                  <p className="mt-8 max-w-md text-sm leading-relaxed text-faint">{t.scan.hint}</p>
                  <Link href="/" className="btn-ghost mt-6">
                    {t.scan.cancel}
                  </Link>
                </div>
              </div>
            </motion.section>
          )}

          {phase === 'error' && (
            <motion.section key="error" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="relative container-page pb-16 pt-32 md:pb-28 md:pt-40" data-testid="scan-error" data-error={error}>
              <div className="panel mx-auto max-w-xl p-8 text-center md:p-12">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-bad/30 bg-bad/10 text-bad">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M12 7v6M12 16.5v.5" />
                    <circle cx="12" cy="12" r="9.5" />
                  </svg>
                </span>
                <h1 className="display mt-6 text-3xl text-ink">{t.scan.errorTitle}</h1>
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
