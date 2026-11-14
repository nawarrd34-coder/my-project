import { safeFetch, SafeFetchError } from '@/lib/security/safeFetch';
import type { SiteErrorCode, SiteProbe } from '@/types/audit';
import { analyzeHtml } from './onpage';

const KEPT_HEADERS = [
  'strict-transport-security',
  'content-security-policy',
  'content-security-policy-report-only',
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy',
  'permissions-policy',
  'x-robots-tag',
  'x-powered-by',
  'server',
  'content-type',
  // Platform fingerprints
  'x-shopid',
  'powered-by',
  'x-shopify-stage',
  'x-wix-request-id',
  'x-magento-tags',
];

const pick = (headers: Record<string, string>) => {
  const out: Record<string, string> = {};
  for (const name of KEPT_HEADERS) {
    if (headers[name]) out[name] = headers[name].slice(0, 300);
  }
  return out;
};

/** Thrown when the target must not be fetched at all (SSRF guard). */
export class BlockedTargetError extends Error {
  constructor(public readonly reason: string) {
    super(`blocked: ${reason}`);
    this.name = 'BlockedTargetError';
  }
}

/** Does plain http:// forward visitors to https://? */
async function checkHttpUpgrade(finalUrl: URL): Promise<boolean | null> {
  if (finalUrl.protocol !== 'https:') return false;
  try {
    const res = await safeFetch(`http://${finalUrl.hostname}/`, { timeoutMs: 8_000, maxBytes: 1_024, maxRedirects: 4 });
    return res.url.startsWith('https://');
  } catch (err) {
    // Port 80 closed entirely: nobody can load the insecure version, which is fine.
    if (err instanceof SafeFetchError && err.code === 'connection_failed') return true;
    return null;
  }
}

/**
 * Fetch the page ourselves: response headers, HTTPS behaviour, and the
 * server-delivered HTML. Network failures are returned as data, not thrown,
 * because PageSpeed may still be able to analyse the page.
 */
export async function probeSite(url: URL): Promise<SiteProbe & { html?: string }> {
  const requestedUrl = url.toString();
  const base: SiteProbe = {
    ok: false,
    requestedUrl,
    finalUrl: requestedUrl,
    status: null,
    redirectCount: 0,
    https: url.protocol === 'https:',
    httpRedirectsToHttps: null,
    ttfbMs: null,
    headers: {},
    onPage: null,
  };

  let res;
  try {
    res = await safeFetch(requestedUrl, { timeoutMs: 15_000, maxBytes: 2_000_000, maxRedirects: 5 });
  } catch (err) {
    if (err instanceof SafeFetchError) {
      if (err.code === 'blocked') throw new BlockedTargetError(err.detail ?? 'blocked');
      return { ...base, error: err.code as SiteErrorCode, errorDetail: err.detail };
    }
    throw err;
  }

  const finalUrl = new URL(res.url);
  const probe: SiteProbe = {
    ...base,
    finalUrl: res.url,
    status: res.status,
    redirectCount: res.redirectCount,
    https: finalUrl.protocol === 'https:',
    ttfbMs: res.ttfbMs,
    headers: pick(res.headers),
  };
  probe.httpRedirectsToHttps = await checkHttpUpgrade(finalUrl);

  if (res.status < 200 || res.status >= 300) {
    return { ...probe, error: 'http_error', errorDetail: String(res.status) };
  }
  if (!res.body.trim()) return { ...probe, error: 'not_html' };

  return { ...probe, ok: true, onPage: analyzeHtml(res.body, res.url), html: res.body };
}
