'use client';

import type { AuditErrorCode, AuditEvent, AuditReport, AuditTaskId } from '@/types/audit';

/** Browser-side helpers for /api/audit, shared by the scan page and the comparison page. */

const CACHE_TTL = 30 * 60 * 1000;
export const cacheKey = (url: string) => `bhc:report:${url.trim().toLowerCase()}`;

export function readCachedReport(url: string): AuditReport | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(url));
    if (!raw) return null;
    const report = JSON.parse(raw) as AuditReport;
    return Date.now() - new Date(report.generatedAt).getTime() < CACHE_TTL ? report : null;
  } catch {
    return null;
  }
}

export function writeCachedReport(url: string, report: AuditReport) {
  try {
    sessionStorage.setItem(cacheKey(url), JSON.stringify(report));
  } catch {
    /* storage unavailable or full: the report still shows */
  }
}

export type AuditOutcome = { ok: true; report: AuditReport } | { ok: false; error: AuditErrorCode | 'network' };

/** Runs one audit, reporting task progress as the server streams it. */
export async function runAudit(url: string, opts: { signal?: AbortSignal; onTask?: (id: AuditTaskId, s: 'start' | 'done' | 'fail') => void }): Promise<AuditOutcome> {
  let res: Response;
  try {
    res = await fetch('/api/audit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }), signal: opts.signal });
  } catch {
    return { ok: false, error: 'network' };
  }
  if (!res.ok || !res.body || !(res.headers.get('content-type') ?? '').includes('ndjson')) {
    const body = (await res.json().catch(() => null)) as AuditEvent | null;
    return { ok: false, error: body && body.t === 'error' ? body.code : 'server_error' };
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let outcome: AuditOutcome | null = null;
  const handle = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as AuditEvent;
    if (event.t === 'task') opts.onTask?.(event.id, event.s);
    else if (event.t === 'result') outcome = { ok: true, report: event.report };
    else if (event.t === 'error') outcome = { ok: false, error: event.code };
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      lines.forEach(handle);
    }
    if (buffer) handle(buffer);
  } catch {
    return { ok: false, error: 'network' };
  }
  return outcome ?? { ok: false, error: 'network' };
}
