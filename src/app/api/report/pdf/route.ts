import { renderReportPdf } from '@/features/reports/renderPdf';
import { pdfRequestSchema } from '@/features/reports/schema';
import { clientKey, rateLimit } from '@/lib/security/rateLimit';
import type { AuditReport } from '@/types/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BODY_BYTES = 400_000;

const fail = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json' } });

export async function POST(request: Request) {
  const limit = rateLimit(`pdf:${clientKey(request.headers)}`, 12, 10 * 60 * 1000);
  if (!limit.allowed) return fail(429, 'rate_limited');

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return fail(413, 'too_large');

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail(400, 'invalid_json');
  }
  const parsed = pdfRequestSchema.safeParse(body);
  if (!parsed.success) return fail(400, 'invalid_report');

  try {
    const { report, locale } = parsed.data;
    const pdf = await renderReportPdf(report as AuditReport, locale);
    const host = report.host.replace(/[^a-z0-9.-]/gi, '_').slice(0, 80);
    return new Response(Buffer.from(pdf), {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="business-health-check-${host}-${locale}.pdf"`,
        'cache-control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[pdf] render failed', err);
    return fail(500, 'render_failed');
  }
}
