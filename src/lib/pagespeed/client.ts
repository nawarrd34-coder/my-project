import type { PsiErrorCode, PsiOutcome, Strategy } from '@/types/audit';
import { parsePageSpeed } from './parse';

const DEFAULT_BASE = 'https://www.googleapis.com/pagespeedonline/v5';
const CATEGORIES = ['PERFORMANCE', 'ACCESSIBILITY', 'SEO', 'BEST_PRACTICES'];

function classify(status: number, message: string): { error: PsiErrorCode; detail?: string } {
  if (status === 429 || /quota|rate ?limit/i.test(message)) return { error: 'quota' };
  if (/api key|API_KEY|permission|not been used|disabled/i.test(message) || status === 403) {
    return { error: 'invalid_key' };
  }
  const lh = /Lighthouse returned error: ([A-Z_]+)/.exec(message);
  if (lh) return { error: 'lighthouse_failed', detail: lh[1] };
  if (/FAILED_DOCUMENT_REQUEST|ERRORED_DOCUMENT_REQUEST|DNS_FAILURE|NO_FCP|unable to resolve/i.test(message)) {
    return { error: 'lighthouse_failed' };
  }
  return { error: 'unknown', detail: `http_${status}` };
}

async function attempt(endpoint: string, timeoutMs: number): Promise<PsiOutcome & { retryable?: boolean }> {
  let res: Response;
  try {
    res = await fetch(endpoint, { signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' });
  } catch (err) {
    const name = (err as Error).name;
    if (name === 'TimeoutError' || name === 'AbortError') return { ok: false, error: 'timeout' };
    return { ok: false, error: 'network', retryable: true };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, error: 'unknown', detail: `http_${res.status}`, retryable: res.status >= 500 };
  }

  if (!res.ok) {
    const message = String((json as { error?: { message?: string } })?.error?.message ?? '');
    return { ok: false, ...classify(res.status, message), retryable: res.status >= 500 && res.status !== 500 };
  }

  const parsed = parsePageSpeed(json);
  if (!parsed.ok) return parsed;
  return parsed;
}

/**
 * Run one PageSpeed Insights (Lighthouse) analysis. Never throws: failures
 * come back as a typed outcome so the report can say exactly what was missed.
 *
 * The API key stays on the server. PAGESPEED_API_BASE can point at a
 * PSI-compatible endpoint (see scripts/local-psi-server.mjs) for local runs.
 */
export async function runPageSpeed(url: string, strategy: Strategy): Promise<PsiOutcome> {
  const base = (process.env.PAGESPEED_API_BASE || DEFAULT_BASE).replace(/\/$/, '');
  const params = new URLSearchParams({ url, strategy: strategy.toUpperCase(), locale: 'en' });
  for (const c of CATEGORIES) params.append('category', c);
  const key = process.env.PAGESPEED_API_KEY;
  if (key) params.set('key', key);
  const endpoint = `${base}/runPagespeed?${params.toString()}`;

  const first = await attempt(endpoint, 100_000);
  if (first.ok || !first.retryable) return strip(first);
  const second = await attempt(endpoint, 60_000);
  return strip(second);
}

function strip(outcome: PsiOutcome & { retryable?: boolean }): PsiOutcome {
  if (outcome.ok) return outcome;
  return { ok: false, error: outcome.error, detail: outcome.detail };
}
