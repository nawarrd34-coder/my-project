import http from 'node:http';
import https from 'node:https';
import zlib from 'node:zlib';
import type { Readable } from 'node:stream';
import { assertSafeUrl, resolvePublicHost, UrlSafetyError, type PinnedAddress } from './ssrf';

export type FetchFailure =
  | 'timeout'
  | 'dns_failed'
  | 'connection_failed'
  | 'tls_error'
  | 'too_many_redirects'
  | 'blocked';

export class SafeFetchError extends Error {
  constructor(
    public readonly code: FetchFailure,
    public readonly detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'SafeFetchError';
  }
}

export interface SafeFetchOptions {
  /** Budget for the whole exchange including redirects. */
  timeoutMs?: number;
  /** Cap on the decompressed body. Extra bytes are discarded. */
  maxBytes?: number;
  maxRedirects?: number;
}

export interface SafeFetchResult {
  url: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  truncated: boolean;
  redirectCount: number;
  ttfbMs: number;
}

const USER_AGENT =
  'Mozilla/5.0 (compatible; BusinessHealthCheck/1.0; website audit requested by the site visitor)';

const TLS_CODES = /CERT|SSL|TLS|SELF_SIGNED|UNABLE_TO_VERIFY|ALTNAME|EPROTO/i;

interface RawResponse {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
  truncated: boolean;
  ttfbMs: number;
}

function flattenHeaders(raw: http.IncomingHttpHeaders): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined) continue;
    out[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : v;
  }
  return out;
}

function requestOnce(
  url: URL,
  pinned: PinnedAddress,
  deadline: number,
  maxBytes: number,
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return reject(new SafeFetchError('timeout'));
    const started = Date.now();
    const isHttps = url.protocol === 'https:';
    const mod = isHttps ? https : http;
    let settled = false;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const req = mod.request({
      protocol: url.protocol,
      hostname: url.hostname.replace(/^\[|\]$/g, ''),
      port: url.port || (isHttps ? 443 : 80),
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      agent: false,
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
        'accept-language': 'ar,en;q=0.8',
        'accept-encoding': 'gzip, deflate, br',
        host: url.host,
      },
      // Connect to the address we validated; never re-resolve the name.
      lookup: (_host: string, opts: unknown, cb: (...args: unknown[]) => void) => {
        const wantsAll = typeof opts === 'object' && opts !== null && (opts as { all?: boolean }).all;
        if (wantsAll) cb(null, [{ address: pinned.address, family: pinned.family }]);
        else cb(null, pinned.address, pinned.family);
      },
      ...(isHttps ? { servername: url.hostname } : {}),
    } as https.RequestOptions);

    const timer = setTimeout(() => {
      done(() => reject(new SafeFetchError('timeout')));
      req.destroy();
    }, remaining);

    req.on('error', (err: NodeJS.ErrnoException) => {
      const code = err.code ?? '';
      done(() =>
        reject(
          TLS_CODES.test(code) || TLS_CODES.test(err.message)
            ? new SafeFetchError('tls_error', code || err.message)
            : new SafeFetchError('connection_failed', code || err.message),
        ),
      );
    });

    req.on('response', (res) => {
      const ttfbMs = Date.now() - started;
      const headers = flattenHeaders(res.headers);
      const status = res.statusCode ?? 0;
      const type = headers['content-type'] ?? '';
      const wantsBody = status >= 200 && status < 300 && /html|xml|text\/plain/i.test(type);
      if (!wantsBody) {
        res.resume();
        res.destroy();
        return done(() => resolve({ status, headers, body: Buffer.alloc(0), truncated: false, ttfbMs }));
      }

      let stream: Readable = res;
      const enc = (headers['content-encoding'] ?? '').toLowerCase();
      if (enc.includes('br')) stream = res.pipe(zlib.createBrotliDecompress());
      else if (enc.includes('gzip')) stream = res.pipe(zlib.createGunzip());
      else if (enc.includes('deflate')) stream = res.pipe(zlib.createInflate());

      const chunks: Buffer[] = [];
      let size = 0;
      let truncated = false;
      const finish = () =>
        done(() => resolve({ status, headers, body: Buffer.concat(chunks), truncated, ttfbMs }));

      stream.on('data', (chunk: Buffer) => {
        if (truncated) return;
        const room = maxBytes - size;
        if (chunk.length > room) {
          // Stop reading: protects against huge pages and decompression bombs.
          chunks.push(chunk.subarray(0, room));
          size = maxBytes;
          truncated = true;
          res.destroy();
          finish();
          return;
        }
        chunks.push(chunk);
        size += chunk.length;
      });
      stream.on('end', finish);
      stream.on('error', () => (chunks.length ? finish() : done(() => reject(new SafeFetchError('connection_failed', 'body')))));
      res.on('error', () => (chunks.length ? finish() : done(() => reject(new SafeFetchError('connection_failed', 'body')))));
    });

    req.end();
  });
}

function decodeBody(body: Buffer, contentType: string): string {
  const match = /charset=["']?([\w-]+)/i.exec(contentType);
  try {
    return new TextDecoder(match?.[1] ?? 'utf-8').decode(body);
  } catch {
    return new TextDecoder('utf-8').decode(body);
  }
}

/**
 * Fetch a public web page without exposing internal infrastructure.
 * Every hop (including each redirect target) is validated, resolved once,
 * and connected to by the validated IP address.
 */
export async function safeFetch(rawUrl: string, opts: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const maxBytes = opts.maxBytes ?? 2_000_000;
  const maxRedirects = opts.maxRedirects ?? 5;
  const deadline = Date.now() + timeoutMs;

  let url = new URL(rawUrl);
  let redirectCount = 0;

  for (;;) {
    let pinned: PinnedAddress;
    try {
      assertSafeUrl(url);
      pinned = await resolvePublicHost(url.hostname);
    } catch (err) {
      if (err instanceof UrlSafetyError) {
        throw new SafeFetchError(err.code === 'dns_failed' ? 'dns_failed' : 'blocked', err.code);
      }
      throw err;
    }

    const res = await requestOnce(url, pinned, deadline, maxBytes);
    const location = res.headers.location;
    if ([301, 302, 303, 307, 308].includes(res.status) && location) {
      if (redirectCount >= maxRedirects) throw new SafeFetchError('too_many_redirects');
      let next: URL;
      try {
        next = new URL(location, url);
      } catch {
        throw new SafeFetchError('connection_failed', 'bad_redirect');
      }
      next.hash = '';
      url = next;
      redirectCount += 1;
      continue;
    }

    return {
      url: url.toString(),
      status: res.status,
      headers: res.headers,
      body: decodeBody(res.body, res.headers['content-type'] ?? ''),
      truncated: res.truncated,
      redirectCount,
      ttfbMs: res.ttfbMs,
    };
  }
}
