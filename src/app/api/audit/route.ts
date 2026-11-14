import { AuditError, runAudit, validateTarget } from '@/features/audit/runAudit';
import { clientKey, rateLimit } from '@/lib/security/rateLimit';
import type { AuditEvent } from '@/types/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Two Lighthouse runs can take a while on slow sites.
export const maxDuration = 180;

const AUDITS_PER_WINDOW = 6;
const WINDOW_MS = 10 * 60 * 1000;

const json = (body: AuditEvent, status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

export async function POST(request: Request) {
  const limit = rateLimit(`audit:${clientKey(request.headers)}`, AUDITS_PER_WINDOW, WINDOW_MS);
  if (!limit.allowed) {
    return json({ t: 'error', code: 'rate_limited', detail: String(limit.retryAfterSeconds) }, 429, {
      'retry-after': String(limit.retryAfterSeconds),
    });
  }

  let input: unknown;
  try {
    input = (await request.json())?.url;
  } catch {
    return json({ t: 'error', code: 'invalid_url' }, 400);
  }
  if (typeof input !== 'string') return json({ t: 'error', code: 'invalid_url' }, 400);

  let target: URL;
  try {
    target = await validateTarget(input);
  } catch (err) {
    if (err instanceof AuditError) {
      return json({ t: 'error', code: err.code, detail: err.detail }, err.code === 'unreachable' ? 422 : 400);
    }
    console.error('[audit] validation failed', err);
    return json({ t: 'error', code: 'server_error' }, 500);
  }

  // Newline-delimited JSON: one event per line, flushed as each task settles.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: AuditEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          open = false;
        }
      };
      try {
        const report = await runAudit(target, send);
        send({ t: 'result', report });
      } catch (err) {
        if (err instanceof AuditError) send({ t: 'error', code: err.code, detail: err.detail });
        else {
          console.error('[audit] failed', err);
          send({ t: 'error', code: 'server_error' });
        }
      } finally {
        open = false;
        try {
          controller.close();
        } catch {
          /* client went away */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store, no-transform',
      'x-accel-buffering': 'no',
    },
  });
}
