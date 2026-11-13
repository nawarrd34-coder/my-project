import { randomUUID } from 'node:crypto';
import { runPageSpeed } from '@/lib/pagespeed/client';
import { assertSafeUrl, parseUserUrl, resolvePublicHost, UrlSafetyError } from '@/lib/security/ssrf';
import { summarizeWithAi } from '@/features/recommendations/ai';
import { buildFindings } from '@/features/recommendations/rules';
import { scoreAudit } from '@/features/scoring/engine';
import type { AuditErrorCode, AuditEvent, AuditReport, PsiOutcome } from '@/types/audit';
import { BlockedTargetError, probeSite } from './probe';

export class AuditError extends Error {
  constructor(
    public readonly code: AuditErrorCode,
    public readonly detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'AuditError';
  }
}

type Emit = (event: AuditEvent) => void;

/** Validate and normalise what the visitor typed. Throws AuditError. */
export async function validateTarget(input: string): Promise<URL> {
  let url: URL;
  try {
    url = parseUserUrl(input);
    assertSafeUrl(url);
  } catch (err) {
    if (err instanceof UrlSafetyError) {
      const blocked = ['port_not_allowed', 'ip_literal_not_allowed', 'hostname_not_public', 'credentials_not_allowed'];
      throw new AuditError(blocked.includes(err.code) ? 'blocked_url' : 'invalid_url', err.code);
    }
    throw err;
  }
  try {
    await resolvePublicHost(url.hostname);
  } catch (err) {
    if (err instanceof UrlSafetyError) {
      throw new AuditError(err.code === 'private_address' ? 'blocked_url' : 'unreachable', err.code);
    }
    throw err;
  }
  return url;
}

/**
 * Run the audit. Each task reports when it really starts and finishes, so the
 * progress the visitor sees is the progress of the work — nothing is timed.
 */
export async function runAudit(target: URL, emit: Emit): Promise<AuditReport> {
  const started = Date.now();

  // 1. Connect: fetch the page ourselves (headers, HTTPS behaviour, HTML).
  emit({ t: 'task', id: 'connect', s: 'start' });
  let site;
  try {
    site = await probeSite(target);
  } catch (err) {
    if (err instanceof BlockedTargetError) {
      emit({ t: 'task', id: 'connect', s: 'fail', code: 'blocked' });
      throw new AuditError('blocked_url', err.reason);
    }
    throw err;
  }
  if (site.error === 'dns_failed') {
    emit({ t: 'task', id: 'connect', s: 'fail', code: site.error });
    throw new AuditError('unreachable', 'dns_failed');
  }
  emit({ t: 'task', id: 'connect', s: site.ok ? 'done' : 'fail', code: site.error });

  // 2 + 3. Lighthouse through PageSpeed Insights, both strategies in parallel.
  // PageSpeed is given the URL the visitor asked for; Google follows redirects itself.
  const psi = (strategy: 'mobile' | 'desktop'): Promise<PsiOutcome> => {
    const id = strategy === 'mobile' ? 'psi_mobile' : 'psi_desktop';
    emit({ t: 'task', id, s: 'start' });
    return runPageSpeed(site.ok ? site.finalUrl : target.toString(), strategy).then((outcome) => {
      if (outcome.ok) outcome.data.strategy = strategy;
      emit({ t: 'task', id, s: outcome.ok ? 'done' : 'fail', code: outcome.ok ? undefined : outcome.error });
      return outcome;
    });
  };
  const mobilePromise = psi('mobile');
  const desktopPromise = psi('desktop');

  // 4 + 5. On-page and security analysis use the probe and finish at once;
  // they are reported honestly as done (or failed when the page was unreadable).
  emit({ t: 'task', id: 'onpage', s: 'start' });
  emit({ t: 'task', id: 'onpage', s: site.onPage ? 'done' : 'fail', code: site.onPage ? undefined : (site.error ?? 'no_html') });
  emit({ t: 'task', id: 'security', s: 'start' });
  const securityRead = site.status !== null || site.error === 'tls_error';
  emit({ t: 'task', id: 'security', s: securityRead ? 'done' : 'fail', code: securityRead ? undefined : site.error });

  const [mobile, desktop] = await Promise.all([mobilePromise, desktopPromise]);

  if (!site.ok && site.error !== 'tls_error' && !mobile.ok && !desktop.ok) {
    throw new AuditError('unreachable', site.error ?? 'no_data');
  }

  // 6. Scoring and recommendations.
  emit({ t: 'task', id: 'scoring', s: 'start' });
  const { categories, overall } = scoreAudit({ site, mobile, desktop });
  const { findings, strengths } = buildFindings({ site, mobile, desktop });
  const finalUrl = site.status !== null ? site.finalUrl : target.toString();
  const host = new URL(finalUrl).hostname;
  const ai = await summarizeWithAi({ host, overall: overall.score, categories, findings });
  emit({ t: 'task', id: 'scoring', s: 'done' });

  return {
    version: 1,
    id: randomUUID(),
    requestedUrl: target.toString(),
    finalUrl,
    host,
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    overall,
    categories,
    psi: { mobile, desktop },
    site,
    findings,
    strengths,
    ai,
  };
}
